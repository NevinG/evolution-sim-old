class World{
    agents = [];
    stepsPerGeneration = 200;
    currentSteps = 0;
    currentGeneration = 0;
    killOnTouch = false;
    killOnBorderTouch = false;
    repopulateGeneration = false;
    repopulateGenerationTo = 20;
    borders = true;
    obstacles = [];
    killZones = [];

    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    //public methods
    addAgents(rays, fov, viewDistance, inputs, hiddenLayers, outputs, n){
        for(let i = 0; i < n; i++){
            //agent with 3 rays and 180 fov and 5 view distance
            let agent = new Agent(rays, fov / 180 * Math.PI, viewDistance, inputs, hiddenLayers, outputs);
            agent.index = i;

            this.randomPositionForAgent(agent);

            //add agent to world
            this.agents.push(agent);
        }
    }

    randomPositionForAgent(agent){
        //random position & rotation --but not in killzone
        let x;
        let y;
        let rotation = Math.random() * Math.PI * 2;

        let noSpanErrors = false;
        while(!noSpanErrors){
            x = Math.floor(Math.random() * this.width);
            y = Math.floor(Math.random() * this.height);

            noSpanErrors = true;
            for(let i = 0; i < this.obstacles.length; i++){
                if(this.pointInPolygon({x: x, y: y}, this.obstacles[i])){
                    noSpanErrors = false;
                    break;
                }
            }
            if(!noSpanErrors)
                continue

            for(let i = 0; i < this.killZones.length; i++){
                if(this.pointInPolygon({x: x, y: y}, this.killZones[i])){
                    noSpanErrors = false;
                    break;
                }
            }
        }

        agent.position.x = x
        agent.position.y = y
        agent.rotation = rotation;
    }

    simulate(){
        this.moveAgents();

        this.raycast();
        this.getAgentInputs();

        this.currentSteps++;
        if(this.currentSteps >= this.stepsPerGeneration){
            this.currentSteps = 0;
            this.currentGeneration++;
            this.endGeneration();
        }
    }

    endGeneration(){
        console.log(`Gen ${this.currentGeneration}: ${this.agents.length} alive`);
        //reproduce
        this.agents = this.agents.map(agent => agent.reproduce());
        this.agents.forEach((agent, i) => {
            //random position & rotation
            this.randomPositionForAgent(agent);
            agent.index = i;
        });
        //repopulate
        if(this.repopulateGeneration){
            while(this.agents.length < this.repopulateGenerationTo){
                let newAgent = this.agents[Math.floor(Math.random() * this.agents.length)].reproduce();
                this.randomPositionForAgent(newAgent);
                newAgent.index = this.agents.length;
                this.agents.push(newAgent);
            }
        }
        //mutate
        this.agents.forEach(agent => {
            agent.mutate();
        });

        this.raycast();
        this.getAgentInputs();
    }

    getAgentInputs(){
        this.agents.forEach(agent => {
            agent.computeNN();
        });
    }

    moveAgents(){
        this.agents.forEach(agent => {
            agent.move();
        });

        //check agent against borders
        if(this.borders){
            for(let i = 0; i < this.agents.length; i++){
                let borderTouch = false;
                if(this.agents[i].position.x > this.width){
                    this.agents[i].position.x = this.width;
                    borderTouch = true;
                }
                if(this.agents[i].position.x < 0){
                    this.agents[i].position.x = 0;
                    borderTouch = true;
                }
                if(this.agents[i].position.y < 0){
                    this.agents[i].position.y = 0;
                    borderTouch = true;
                }
                if(this.agents[i].position.y > this.height){
                    this.agents[i].position.y = this.height;
                    borderTouch = true;
                }

                if(this.killOnBorderTouch && borderTouch){
                    this.agents[i] = null;
                }
            }
            this.agents = this.agents.filter(agent => agent != null);
        }
        if(this.killOnTouch){
            for(let i = 0; i < this.agents.length; i++){
                for(let j = 0; j < this.agents.length; j++){
                    if(i == j || this.agents[i] == null || this.agents[j] == null)
                        continue;

                    let dist = Math.sqrt(Math.pow(this.agents[i].position.x - this.agents[j].position.x, 2) + Math.pow(this.agents[i].position.y - this.agents[j].position.y, 2));
                    if(dist <= 1){
                        this.agents[i] = null;
                        this.agents[j] = null;
                    }
                }
            }
            this.agents = this.agents.filter(agent => agent != null);
        }

        //check against kill zones
        for(let i = 0; i < this.agents.length; i++){
            for(let j = 0; j < this.killZones.length; j++){
                if(this.pointInPolygon(this.agents[i].position, this.killZones[j])){
                    this.agents[i] = null;
                    break;
                }
            }
        }
        this.agents = this.agents.filter(agent => agent != null);

        //check for moving into obstacle
        this.obstacles.forEach(obstacle => {
            for(let i = 0; i < this.agents.length; i++){
                if(this.pointInPolygon(this.agents[i].position, obstacle) && !this.pointInPolygon(this.agents[i].lastPosition, obstacle)){
                    this.agents[i].position.x = this.agents[i].lastPosition.x;
                    this.agents[i].position.y = this.agents[i].lastPosition.y;
                }
            }
        })
    }

    handleClick(x, y){
        //check for click on agent
        for(let i = 0; i < this.agents.length; i++){
            let dist = Math.sqrt(Math.pow(x - this.agents[i].position.x,2) + Math.pow(y - this.agents[i].position.y, 2));
            if (dist <= .5){
                return this.agents[i];
            }
        }
    }

    raycast(){
        this.agents.forEach(agent => {
            let rotation = agent.rotation - agent.fov / 2;
            let raycastValues = [];
            for(let i = 0; i < agent.numOfRays; i++){
                //ray
                let initX = agent.position.x;
                let initY = agent.position.y;
                let finalX = agent.position.x + Math.cos(rotation) * agent.viewDistance;
                let finalY = agent.position.y + Math.sin(rotation) * agent.viewDistance;
                let m = (finalY - initY) / (finalX - initX); //double check
                let e = initY - m*initX; //double check

                let minDistance = agent.viewDistance;

                //raycast with other agents
                this.agents.forEach(otherAgent => {
                    if(agent == otherAgent)
                        return

                    //make sure agent is on correct side of line
                    if(finalX >= initX && otherAgent.position.x <= initX)
                        return

                    if(finalX <= initX && otherAgent.position.x >= initX)
                        return

                    let a = m*m + 1;
                    let b = (2*m*e-2*otherAgent.position.x-2*otherAgent.position.y*m);
                    let c = (otherAgent.position.x*otherAgent.position.x - 2* otherAgent.position.y*e+ otherAgent.position.y*otherAgent.position.y - .5*.5 + e*e);

                    if(b*b -4*a*c >= 0){
                        let x1 = (-b + Math.sqrt(b*b -4*a*c))/(2*a);
                        let x2 = (-b - Math.sqrt(b*b -4*a*c))/(2*a);
                        
                        let new_x = Math.abs(x1 - initX) < Math.abs(x2 - initX) ? x1 : x2;
                        let new_y = m*new_x + e;
                        
                        let new_dist = Math.sqrt(Math.pow(initX - new_x,2) + Math.pow(initY - new_y,2));
                        minDistance = Math.min(minDistance, new_dist);
                    }
                });

                //raycast with the border
                if(this.borders){
                    let x1 = null;
                    let y1 = null;
                    let dist = null;
                    if(finalX >= this.width){
                        x1 = this.width;
                        y1 = m * x1 + e;
                        dist = Math.sqrt(Math.pow(x1 - initX, 2) + Math.pow(y1 - initY,2));
                        minDistance = Math.min(minDistance, dist);
                    }
                    if (finalX <= 0){
                        x1 = 0;
                        y1 = m * x1 + e;
                        dist = Math.sqrt(Math.pow(x1 - initX, 2) + Math.pow(y1 - initY,2));
                        minDistance = Math.min(minDistance, dist);
                    }
                    if (finalY >= this.height){
                        y1 = this.height;
                        x1 = (y1 - e) / m;
                        dist = Math.sqrt(Math.pow(x1 - initX, 2) + Math.pow(y1 - initY,2));
                        minDistance = Math.min(minDistance, dist);
                    }
                    if (finalY <= 0){
                        y1 = 0;
                        x1 = (y1 - e) / m;
                        dist = Math.sqrt(Math.pow(x1 - initX, 2) + Math.pow(y1 - initY,2));
                        minDistance = Math.min(minDistance, dist);
                    }
                }

                //raycast with obstacles and kill zones
                this.obstacles.forEach(raycastPolygon); 
                this.killZones.forEach(raycastPolygon);
                function raycastPolygon(obstacle){
                    let pointA = obstacle[0];
                    let pointB = obstacle[1];
                    for(let k = 0; k < obstacle.length; k++){
                        //get if raycast intersects with line of polygon
                        let m2 = (pointA[1] -  pointB[1]) / (pointA[0] - pointB[0]);
                        let e2 = pointB[1] - m2 * pointB[0];
                        if(m != m2){
                            let intersectX = (e2 - e) / (m-m2);
                            let intersectY = m2*intersectX + e2;

                            if(Math.sign(intersectX - pointA[0]) != Math.sign(intersectX - pointB[0]) &&
                                Math.sign(intersectY - pointA[1]) != Math.sign(intersectY - pointB[1])){
                                if(Math.sign(intersectX - initX) == Math.sign(finalX - initX)){
                                    let intersectDist = Math.sqrt(Math.pow(initX - intersectX,2) + Math.pow(initY - intersectY,2));
                                    minDistance = Math.min(minDistance, intersectDist);
                                }
                            }
                        }
                        pointA = pointB;
                        pointB = obstacle[(2 + k) % obstacle.length];
                    }
                }

                raycastValues.push(minDistance);
                rotation += agent.fov / (agent.numOfRays - 1);
            }

            agent.raycastValues = raycastValues;
        })
    }

    pointInPolygon(point, polygon){
        //draw ray from point to the right
        //count number of intersections with the polygon
        //inside if odd, outside if even

        //check if x value of line segment is to right of point
        //check if y value of point is within line segment
        let pointA = polygon[0];
        let pointB = polygon[1];

        let count = 0;
        for(let i = 0; i < polygon.length; i++){
            if(
                Math.max(pointA[0], pointB[0]) >= point.x &&
                (Math.sign(pointA[1] - point.y) != Math.sign(pointB[1] - point.y))
            ){
                //get point on line segment with same y value
                let m = (pointB[0] - pointA[0]) / (pointB[1] - pointA[1]);
                let b = pointB[0] - m*pointB[1];

                if(point.y*m + b >= point.x)
                    count++;
            }

            pointA = pointB;
            pointB = polygon[(2 + i) % polygon.length];
        }
        return count % 2 == 1;
    }
}