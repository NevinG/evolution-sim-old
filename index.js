const renderer = document.getElementById("renderer");
const context = renderer.getContext("2d");

const ZOOM_SPEED = .025;
const PANNING_SPEED = 1;

let LOOP_ID = null;
let GRID_LINES = true;
let BORDER = true;
let VIEW_RAYCASTS = false;
let RENDER_MODE = "world";
let CURRENT_RENDER_OBJECT = null;
let PLAYBACK_SPEED = 20;
let PAUSED = true;
let MOUSE_POS = {x: 0, y: 0};
let CAMERA_ZOOM = 1;
let CAMERA_OFFSET = {x: 0, y: 0};
let RENDER_QUEUE = [];
let INSPECTING_AGENT = null;
let FOLLOWING_AGENT = null;
let RENDER_BUTTONS = [];
let FOLLOWING = false;

let ADDING_OBSTACLE = false;
let ADDING_KILL_ZONE = false;
let CURRENT_OBSTACLE = [];

let world = null;

function togglePause(){
    if(!PAUSED){
        clearInterval(LOOP_ID);
        PAUSED = true;
    }else{
        updateLoop();
        PAUSED = false;
    }
}

function updateLoop(){
    if(LOOP_ID != null){
        clearInterval(LOOP_ID);
    }

    LOOP_ID = setInterval(() => {
        if(!PAUSED){
            world.simulate();
            render();
        }
    }, 1000 / PLAYBACK_SPEED);
}

function submitWorld(width, height){
    initalize();
    world = new World(width,height);
    render();
}

function submitAgents(agents){
    initalize();
    agents.forEach(agent => {
        world.addAgents(agent.rays, agent.fov, agent.viewDistance, agent.inputs, agent.hiddenLayers, agent.outputs, agent.n);
    })
    //first interation
    world.raycast();
    world.getAgentInputs();
    //we don't move agents so we can observe their starting spot
    render();
}

function initalize(){
    renderer.width = renderer.offsetWidth;
    renderer.height = renderer.offsetHeight;
}

function render(obj = CURRENT_RENDER_OBJECT){
    // Reset transformation matrix to the identity matrix
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, renderer.width, renderer.height);

    if(obj instanceof Agent){
        RENDER_MODE = "agent";
        renderAgent(obj)
    } else if (obj instanceof World){
        RENDER_MODE = "world";
        renderWorld();
    } else if (obj == null){
        RENDER_MODE = "world";
        renderWorld();
    } else {
        throw new Error("Invalid render type")
    }

    function renderWorld(){
        CURRENT_RENDER_OBJECT = world;
        //render world
        if(FOLLOWING){
            CAMERA_OFFSET.x = 0;
            CAMERA_OFFSET.y = 0;
            let cameraPos = worldToMousePos(FOLLOWING_AGENT.position);
            CAMERA_OFFSET.x = renderer.width / 2 - cameraPos.x
            CAMERA_OFFSET.y = renderer.height / 2 - cameraPos.y
        }
        //matrix transformation for zoom and pan
        let defaultTranslate = () => {
            context.translate(renderer.width / 2, renderer.height / 2);
            context.translate(CAMERA_OFFSET.x, CAMERA_OFFSET.y);
            context.scale(CAMERA_ZOOM, CAMERA_ZOOM);
            context.translate(-renderer.width / 2, -renderer.height / 2);
        }
        defaultTranslate();
        
        //render grid lines
        if(GRID_LINES){
            context.beginPath();
            context.strokeStyle = "gray";
            context.lineWidth = 1 / CAMERA_ZOOM; //make line width constant no matter zoom
            for(let i = 0; i <= world.width; i++){
                context.moveTo(i / world.width * renderer.width, 0);
                context.lineTo(i / world.width * renderer.width, renderer.height);
            }
            for(let i = 0; i <= world.height; i++){
                context.moveTo(0, i / world.height * renderer.height);
                context.lineTo(renderer.width,  i / world.height * renderer.height);
            }
            context.stroke();
            context.strokeStyle = "black";
            context.lineWidth = 1; //reset line width;
        }

        if(BORDER){
            context.beginPath();
            context.strokeStyle = "red";
            context.lineWidth = 1 / CAMERA_ZOOM * 3;

            context.moveTo(0,0);
            context.lineTo(renderer.width,0);
            context.lineTo(renderer.width,renderer.height);
            context.lineTo(0,renderer.height);
            context.lineTo(0,0);

            context.stroke();
            context.strokeStyle = "black";
            context.lineWidth = 1; //reset line width;
        }
    
        //render agents
        context.strokeStyle = "black";
        world.agents.forEach(agent => {
            //agent location
            let x = agent.position.x / world.width * renderer.width;
            let y = agent.position.y / world.height * renderer.height;
            let unitWidth = renderer.width / world.width;
            let unitHeight = renderer.height / world.height;

            //matrix transformation to draw rotated rect
            context.translate(x, y);
            context.rotate(agent.rotation);
            context.translate(-x, -y);

            //draw rays
            if(VIEW_RAYCASTS){
                context.lineWidth = 1 / CAMERA_ZOOM; //make raycast same size regardless of zoom
                let rotation = -agent.fov / 2;
                for(let i = 0; i < agent.numOfRays; i++){
                    context.beginPath();
                    context.strokeStyle = agent.raycastValues[i] < agent.viewDistance ? "red" : "blue";
                    context.moveTo(x, y);
                    context.lineTo(x + Math.cos(rotation) * unitWidth * agent.raycastValues[i], y + Math.sin(rotation) * unitHeight * agent.raycastValues[i]);
        
                    rotation += agent.fov / (agent.numOfRays - 1);

                    context.stroke();
                }
                context.strokeStyle = "black";
                context.lineWidth = 1; //reset line width
            }

            //draw agent
            context.beginPath();
            context.arc(x, y, unitWidth / 2, 0, Math.PI * 2);
            context.fill();

            // Reset transformation matrix to the identity matrix
            context.setTransform(1, 0, 0, 1, 0, 0);
            //matrix transformation for zoom and pan
            defaultTranslate();
        })

        //render Obstacle creation
        context.fillStyle = "yellow";
        if(ADDING_OBSTACLE){
            CURRENT_OBSTACLE.forEach(obstacle => {
                let pos = {x: obstacle[0] / world.width * renderer.width, y: obstacle[1]/ world.height * renderer.height};
                context.beginPath();
                context.arc(pos.x, pos.y, renderer.width / world.width / 4, 0, Math.PI * 2);
                context.fill();
            });
        }
        context.fillStyle = "black";

        //render the current obstacles & kill zones
        context.strokeStyle = "black";
        context.fillStyle = "rgb(0,0,0,.5)";
        renderPolygons(world.obstacles);
        context.strokeStyle = "red";
        context.fillStyle = "rgb(255,0,0,.5)";
        renderPolygons(world.killZones);

        function renderPolygons(polygons){
            for(let i = 0; i < polygons.length; i++){
                context.beginPath();
                let pos = {x: polygons[i][0][0]/ world.width * renderer.width, y: polygons[i][0][1]/ world.height * renderer.height};
                context.moveTo(pos.x, pos.y);
                for(let j = 1; j < polygons[i].length; j++){
                    pos = {x: polygons[i][j][0]/ world.width * renderer.width, y: polygons[i][j][1]/ world.height * renderer.height};
                    context.lineTo(pos.x, pos.y);
                }
                pos = {x: polygons[i][0][0]/ world.width * renderer.width, y: polygons[i][0][1]/ world.height * renderer.height};
                context.lineTo(pos.x, pos.y);
                context.stroke();
                context.fill();
            }
        }
        context.strokeStyle = "black";
        context.fillStyle = "black";

        // Reset transformation matrix to the identity matrix
        context.setTransform(1, 0, 0, 1, 0, 0);
        //render stats in top left
        context.font = "16px monospace";
        let text = [
            `#Agents: ${world.agents.length}`,
            `Current Step: ${world.currentSteps}`,
            `Current Generation: ${world.currentGeneration}`
        ];
        text.forEach((string,i) => {
            context.fillText(string, 5, 5 + 12 + 16*i);
        })

        //render inspecting agent popup
        if(INSPECTING_AGENT != null){
            let pos = worldToMousePos({x: INSPECTING_AGENT.position.x, y: INSPECTING_AGENT.position.y});
            renderPopup(pos.x, pos.y, [{string: "\u2610 Follow", callback: () => followAgent(INSPECTING_AGENT)}, {string: "\u2610 Inspect ", callback: () => render(INSPECTING_AGENT)}], false);
        }
    }
    
    function renderAgent(agent){     
        CURRENT_RENDER_OBJECT = agent;   
        //render singular agent in top half

        //agent location
        let x = renderer.width / 2;
        let y = renderer.height / 4;
        let unitWidth = renderer.width / world.width;
        let unitHeight = renderer.height / world.height;

        //matrix transformation to draw rotated rect
        context.translate(x, y);
        context.rotate(agent.rotation);
        context.translate(-x, -y);

        //draw rays
        let rotation = -agent.fov / 2;
        for(let i = 0; i < agent.numOfRays; i++){
            context.beginPath();
            context.strokeStyle = agent.raycastValues[i] < agent.viewDistance ? "red" : "blue";
            context.moveTo(x, y);
            context.lineTo(x + Math.cos(rotation) * renderer.width / 20 * agent.raycastValues[i], y + Math.sin(rotation) * renderer.width / 20 * agent.raycastValues[i]);
            context.stroke();
            rotation += agent.fov / (agent.numOfRays - 1);
        }
        context.strokeStyle = "black";

        //draw agent
        context.beginPath();
        context.arc(x, y, renderer.width / 40, 0, Math.PI * 2);
        context.fill();

        // Reset transformation matrix to the identity matrix
        context.setTransform(1, 0, 0, 1, 0, 0);

        //agent popups
        if(Math.sqrt(Math.pow(x-unitWidth / 2 - MOUSE_POS.x, 2) + Math.pow(y - unitHeight / 2 - MOUSE_POS.y, 2)) <= unitWidth){
            queuePopup(MOUSE_POS.x, MOUSE_POS.y, [{string: `Agent${agent.index}`}, {string: `Position: (${agent.position.x.toFixed(2)}, ${agent.position.y.toFixed(2)})`}, {string: `Rotation: ${(agent.rotation * 180 / Math.PI).toFixed(2)}\u00B0`}, {string: `Velocity: ${agent.velocity.toFixed(2)}`}, {string: `Angular Velocity: ${(agent.angularVelocity * 180 / Math.PI).toFixed(2)}\u00B0`}, {string: `# Rays: ${agent.numOfRays}`}, {string: `FOV: ${(180 * agent.fov / Math.PI).toFixed(2)}\u00B0`}, {string: `View Distance: ${agent.viewDistance}`}]);
        }
        //render nn in bottom half
        x = renderer.width / 8;
        y = renderer.height /2;
        let maxNodesY = Math.max(agent.nn.inputSize, ...agent.nn.layers.map(layer => layer.nodes.length));
        let maxNodesX = agent.nn.layers.length + 1;
        let nodeLocations = [];
        //render nodes
        let xStep = (renderer.width * 3/4) / maxNodesX;
        let yStep = (renderer.height / 2) / maxNodesY;
        let diameter = Math.min(xStep, yStep);
        let fontSize = 32;
        context.font = `${fontSize}px monospace`;
        let fontDim = context.measureText("AAA");
        while(fontDim.width > diameter){
            fontSize--;
            context.font = `${fontSize}px monospace`;
            fontDim = context.measureText("AAA");
        }
        //input nodes
        let layerX = x + (renderer.width * 3/4 - xStep * agent.nn.layers.length) / 2;
        let layerY = y + (renderer.height / 2 - diameter * agent.nn.inputSize) / 2;
        let layerNodeLocations = [];
        for(let i = 0; i < agent.nn.inputSize; i++){
            context.beginPath();
            context.ellipse(layerX, layerY + yStep * i, diameter / 2, diameter / 2, 0, 0, 2* Math.PI);
            layerNodeLocations.push([layerX, layerY + yStep * i]);
            context.stroke();

            let text = numToString(agent.nn.lastInput[i], 3);
            let textDim = context.measureText(text);
            context.fillText(text, layerX - textDim.width / 2, layerY + yStep * i + fontSize / 4);

            //render popupinformation on hover
            if(Math.sqrt(Math.pow(layerX - MOUSE_POS.x, 2) + Math.pow(layerY + yStep * i - MOUSE_POS.y, 2)) <= diameter / 2){
                queuePopup(MOUSE_POS.x, MOUSE_POS.y, [{string: `${agent.nn.inputLabels[i]} Input`}, {string: `Value: ${agent.nn.lastInput[i].toFixed(2)}`}]);
            }
        }
        nodeLocations.push(layerNodeLocations);

        //hidden layer nodes
        for(let i = 0; i < agent.nn.layers.length; i++){
            layerY = y + (renderer.height / 2 - diameter * agent.nn.layers[i].nodes.length) / 2;
            layerNodeLocations = [];
            for(let j = 0; j < agent.nn.layers[i].nodes.length; j++){
                context.beginPath();
                context.ellipse(layerX + (i + 1) * xStep, layerY + yStep * j, diameter / 2, diameter / 2, 0, 0, 2* Math.PI);
                layerNodeLocations.push([layerX + (i + 1) * xStep, layerY + yStep * j]);
                context.stroke();

                let text = numToString(agent.nn.layers[i].nodes[j].value, 3);
                let textDim = context.measureText(text);
                context.fillText(text, layerX + (i + 1) * xStep- textDim.width / 2, layerY + yStep * j + fontSize / 4);

                //render popupinformation on hover
                if(Math.sqrt(Math.pow(layerX + (i + 1) * xStep - MOUSE_POS.x, 2) + Math.pow(layerY + yStep * j - MOUSE_POS.y, 2)) <= diameter / 2){
                    if(i + 1 != agent.nn.layers.length){ //hidden layer
                        queuePopup(MOUSE_POS.x, MOUSE_POS.y, [{string: "Hidden Node"}, {string: `Weights: ${agent.nn.layers[i].nodes[j].weights.map(w => w.toFixed(2))}`}, {string: `Bias: ${agent.nn.layers[i].nodes[j].bias.toFixed(2)}`}, {string: `Value: ${agent.nn.layers[i].nodes[j].value.toFixed(2)}`}]);
                    }else { //output layer
                        queuePopup(MOUSE_POS.x, MOUSE_POS.y, [{string: `${agent.nn.outputs[j]} Output`}, {string: `Weights: ${agent.nn.layers[i].nodes[j].weights.map(w => w.toFixed(2))}`}, {string: `Bias: ${agent.nn.layers[i].nodes[j].bias.toFixed(2)}`}, {string: `Value: ${agent.nn.layers[i].nodes[j].value.toFixed(2)}`}]);
                    }
                }
            }
            nodeLocations.push(layerNodeLocations);
        }

        //weights of NN
        for(let i = 1; i < nodeLocations.length; i++){
            for(let j = 0; j < nodeLocations[i].length; j++){
                for(let k = 0; k < nodeLocations[i - 1].length; k++){
                    context.beginPath();
                    //line thickness based on weights value
                    context.lineWidth = diameter / 50 * Math.min(3, Math.max(2 * Math.abs(agent.nn.layers[i - 1].nodes[j].weights[k]), .05)); 
                    context.moveTo(nodeLocations[i][j][0] - diameter / 2, nodeLocations[i][j][1]);
                    context.lineTo(nodeLocations[i-1][k][0] + diameter / 2, nodeLocations[i-1][k][1]);
                    context.stroke();
                }
            }
        }
        context.lineWidth = 1;
        
    }

    RENDER_QUEUEDPopups();
}

function queuePopup(x, y, strings){
    RENDER_QUEUE.push([x, y, strings]);
}

function RENDER_QUEUEDPopups(){
    while(RENDER_QUEUE.length > 0){
        let item = RENDER_QUEUE.shift();
        renderPopup(item[0], item[1], item[2]);
    }
}

function renderPopup(x, y, strings, offset = true){
    //break up long strings into multiple lines
    let newStrings = [];
    for(let i = 0; i < strings.length; i++){
        if(8.8 * strings[i].string.length > renderer.width - 10){
            newStrings.push({string: strings[i].string.substring(0, Math.floor((renderer.width - 10) / 8.8)), callback: strings[i].callback});
            strings[i].string = strings[i].string.substring(Math.floor((renderer.width - 10) / 8.8));
            i--;
        }
        else{
            newStrings.push({string: strings[i].string, callback: strings[i].callback});
        }
    }
    strings = newStrings;

    context.font = "16px monospace";
    let popupWidth = 8.8 * Math.max(...strings.map(e => e.string.length)) + 10;
    let popupHeight = 16 * strings.length + 10;

    //render in area with most space using offsets
    let xOffset = 0
    let yOffset = 0
    if(offset){
        if(y <= renderer.height / 2){
            yOffset += popupHeight + 10;
        }
        if(x >= renderer.width / 2){
            yOffset -= 10;
            xOffset -= popupWidth;
        }
        //move popup back into bounds
        if(xOffset + x < 0){
            xOffset += -(xOffset + x);
        } else if(xOffset + x + popupWidth > renderer.width){
            xOffset -= (xOffset + x + popupWidth - renderer.width)
        }
        if(yOffset + y - popupHeight < 0){
            yOffset += -(yOffset + y - popupHeight);
        } else if(yOffset + y > renderer.height){
            yOffset -= (yOffset + y - renderer.height);
        }
    }
    context.clearRect(xOffset + x, yOffset + y - popupHeight, popupWidth, popupHeight);
    context.strokeRect(xOffset + x,yOffset + y - popupHeight, popupWidth, popupHeight);
    strings.forEach((string, i) => {
        context.fillText(string.string, xOffset + x + 5, yOffset + 5 + 12 + y + 16 * i - popupHeight);
    });

    //make ones with callback function have buttons
    RENDER_BUTTONS = [];
    strings.forEach((string, i) => {
        if(string.callback != undefined){
            let xPos = xOffset + x + 5;
            let yPos = yOffset + 5 + 12 + y + 16 * i - popupHeight;
            RENDER_BUTTONS.push({
                pos: {x: xPos, y: yPos - 10.5}, //top left point... I think
                width: popupWidth, 
                height: 21,
                callback: string.callback
            }); 
        }
    });
}

function numToString(num, length){
    let result = num >= 0 ? "" : "-";
    num = Math.abs(num);

    let integer = Math.floor(num);
    let decimal = num - integer;

    if(integer != 0){
        result += integer
    }
    result += ".";
    result += decimal.toString().substring(2);
    result = result.substring(0,length);
    if(result[result.length - 1] == ".")
        result = result.substring(0,result.length - 1);
    if(result == "")
        return "0";
    return result;
}

function mouseToWorldPoint(pos){
    let x = pos.x;
    let y = pos.y;
    
    x -= renderer.width / 2;
    y -= renderer.height / 2;

    x -= CAMERA_OFFSET.x;
    y -= CAMERA_OFFSET.y;
    
    x /= CAMERA_ZOOM;
    y /= CAMERA_ZOOM;
    
    x += renderer.width / 2;
    y += renderer.height / 2;

    res = {};
    res.x = x / renderer.width * world.width;
    res.y = y / renderer.height * world.height;
    return res;
}

function worldToMousePos(pos){
    let x = pos.x;
    let y = pos.y;

    x /= (world.width / renderer.width);
    y /= (world.height / renderer.height);
    x -= renderer.width / 2;
    y -= renderer.height / 2;
    x *= CAMERA_ZOOM;
    y *= CAMERA_ZOOM;
    x += CAMERA_OFFSET.x;
    y += CAMERA_OFFSET.y;
    x += renderer.width / 2;
    y += renderer.height / 2;
    return {
        x: x,
        y: y,
    }; 
}

function followAgent(agent){
    FOLLOWING = true;
    FOLLOWING_AGENT = agent;
    INSPECTING_AGENT = null;
    render();
}

//send clicks on render element to world
renderer.onmousemove = (e) => {
    if(world == null)
        return;
    if(e.buttons == 1) {//left clicking, so therefore drag
        CAMERA_OFFSET.x += (e.offsetX - MOUSE_POS.x) * PANNING_SPEED;
        CAMERA_OFFSET.y += (e.offsetY - MOUSE_POS.y) * PANNING_SPEED;
    }

    MOUSE_POS.x = e.offsetX;
    MOUSE_POS.y = e.offsetY;

    render()
}
renderer.onclick = (e) => {
    FOLLOWING = false;
    //check if adding obstacle first
    if(ADDING_OBSTACLE){
        let worldPos = mouseToWorldPoint(MOUSE_POS);
        //check if click is at first point
        if(CURRENT_OBSTACLE.length > 2){
            let dist = Math.sqrt(Math.pow(worldPos.x - CURRENT_OBSTACLE[0][0], 2) + Math.pow(worldPos.y - CURRENT_OBSTACLE[0][1],2));
            if(dist <= .25){
                if(ADDING_KILL_ZONE){
                    world.killZones.push(CURRENT_OBSTACLE);
                }else{
                    world.obstacles.push(CURRENT_OBSTACLE);
                }
                world.raycast();
                
                CURRENT_OBSTACLE = [];
                ADDING_OBSTACLE = false;
                ADDING_KILL_ZONE = false;
                render();
                return;
            }
        }
        //otherwise add point to current obstacle
        CURRENT_OBSTACLE.push([worldPos.x, worldPos.y]);

        render();
        return;
    }

    //check for render buttons first
    let clickedButton = false;
    RENDER_BUTTONS.forEach(button => {
        if(MOUSE_POS.x - button.pos.x > 0 && MOUSE_POS.x - button.pos.x <= button.width &&  MOUSE_POS.y - button.pos.y > 0 && MOUSE_POS.y - button.pos.y <= button.height){
            button.callback();
            clickedButton = true;
            return;
        }
    })
    if(clickedButton)
        return;

    if(RENDER_MODE == "world"){
        let worldPos = mouseToWorldPoint(MOUSE_POS);
        let objClickedOn = world.handleClick(worldPos.x, worldPos.y);
        if(objClickedOn instanceof Agent){
            INSPECTING_AGENT = objClickedOn;
            render();
        }else{
            INSPECTING_AGENT = null;
        }
    }
    else if(RENDER_MODE == "agent"){
        render(world);
    }
}
renderer.onmousewheel = (e) => {
    if(e.deltaY < 0){ //zoom in
        CAMERA_ZOOM += ZOOM_SPEED * CAMERA_ZOOM;
    }else{ //zoom out
        CAMERA_ZOOM -= ZOOM_SPEED  * CAMERA_ZOOM;
    }
    CAMERA_ZOOM = Math.max(CAMERA_ZOOM,.5);
    render();
}

//prevents zooming in - needed for laptop
document.body.addEventListener("wheel", e=>{
    if(!Number.isInteger(e.deltaY))
        e.preventDefault();//prevent zoom
}, {passive: false});