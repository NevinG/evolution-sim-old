const inputHeight = document.getElementById("input-height");
const inputWidth = document.getElementById("input-width");
const inputAgent1Rays = document.getElementById("input-agent1Rays");
const inputAgent1Fov = document.getElementById("input-agent1Fov");
const inputAgent1ViewDistance = document.getElementById("input-agent1ViewDistance");
const inputAgent1BrainInputs = document.getElementById("input-agent1BrainInputs");
const inputAgent1BrainHiddenLayers = document.getElementById("input-agent1BrainHiddenLayers");
const inputAgent1BrainOutputs = document.getElementById("input-agent1BrainOutputs");
const inputNumAgent1 = document.getElementById("input-numAgent1");
const inputAddAgent = document.getElementById("input-addAgent");
const agentContainer = document.getElementById("agents-container");
let agentRays = [inputAgent1Rays];
let agentFov = [inputAgent1Fov];
let agentViewDistance = [inputAgent1ViewDistance];
let agentBrainInputs = [inputAgent1BrainInputs];
let agentBrainHiddenLayers = [inputAgent1BrainHiddenLayers];
let agentBrainOutputs = [inputAgent1BrainOutputs];
let numAgents = [inputNumAgent1];

const submitWorldButton = document.getElementById("submit-world");
const submitAgentsButton = document.getElementById("submit-agents");

const inputAddObstacle = document.getElementById("input-addObstacle");
const inputAddKillZone = document.getElementById("input-addKillZone");

const inputGridlines = document.getElementById("input-gridlines");
const inputBorder = document.getElementById("input-border");
const inputViewRaycasts = document.getElementById("input-viewRaycasts");
const inputKillOnTouch = document.getElementById("input-killOnTouch");
const inputKillOnBorderTouch = document.getElementById("input-killOnBorderTouch");
const inputWorldBorders = document.getElementById("input-worldBorders");

const inputPlaybackSpeed = document.getElementById("input-playbackSpeed");
const inputStepsPerGen = document.getElementById("input-stepsPerGen");
const inputRepopulateCheckbox = document.getElementById("input-repopulateCheckbox");
const inputRepopulateAmount = document.getElementById("input-repopulateAmount");
const inputPlayPause = document.getElementById("input-playPause");
const inputSimulationStep = document.getElementById("input-simulationStep");

inputGridlines.onchange = updateProperties;
inputBorder.onchange = updateProperties;
inputViewRaycasts.onchange = updateProperties;
inputKillOnTouch.onchange = updateProperties;
inputKillOnBorderTouch.onchange = updateProperties;
inputWorldBorders.onchange = updateProperties;
inputPlaybackSpeed.onchange = updateProperties;
inputStepsPerGen.onchange = updateProperties;
inputRepopulateCheckbox.onchange = updateProperties;
inputRepopulateAmount.onchange = updateProperties;

submitWorldButton.onclick = () => {
    submitWorld(parseInt(inputWidth.value), parseInt(inputHeight.value));
    updateProperties(); //also want to update properties whenever a new generation is created
}

submitAgentsButton.onclick = () => {
    let agentList = [];
    for(let i = 0; i < agentBrainHiddenLayers.length; i++){
        agentList.push({ 
            rays: parseInt(agentRays[i].value),
            fov: parseInt(agentFov[i].value),
            viewDistance: parseInt(agentViewDistance[i].value),
            inputs: Array.from(agentBrainInputs[i].querySelectorAll("option:checked"),e=>e.value),
            hiddenLayers: JSON.parse(agentBrainHiddenLayers[i].value),
            outputs: Array.from(agentBrainOutputs[i].querySelectorAll("option:checked"),e=>e.value),
            n: parseInt(numAgents[i].value)}
        );
    }
    submitAgents(agentList);
    updateProperties(); //also want to update properties whenever a new generation is created
}

inputSimulationStep.onclick = () => {
    world.simulate();
    render();
}

inputPlayPause.onclick = () => {
    togglePause();
}

inputAddAgent.onclick = () => {
    let n = agentBrainHiddenLayers.length;
    let agentInfo = createElementFromHTML(`
    <div>
        <label>agent${n} # of rays: </label>
        <input id="input-agent1Rays", style="width: 100px", type="number", min="0", step="1", value="5">
        <br>

        <label>agent${n} fov: </label>
        <input id="input-agent1Fov", style="width: 100px", type="number", min="0", step="1", max="360", value="135">
        <br>

        <label>agent${n} view distance: </label>
        <input id="input-agent1ViewDistance", style="width: 100px", type="number", min="0", step="1", value="5">
        <br>

        
        <label style="position: relative; top: -1rem">agent${n} brain inputs: </label>
        <select id="input-agent1BrainInputs", style="width: 100px; height: 3rem;", multiple>
            <option selected value="raycasts">Raycasts</option>
            <option value="velocity">Velocity</option>
            <option value="angularVelocity">Angular Veloctiy</option>
            <option value="xpos">X Position</option>
            <option value="ypos">Y Position</option>
            <option selected value="random">Random</option>
        </select>
        <br>

    
        <label>agent${n} brain hidden layers: </label>
        <input id="input-agent1BrainHiddenLayers", style="width: 100px", type="text", value="[6]">
        <br>

        
        <label style="position: relative; top: -1rem">agent${n} brain outputs: </label>
        <select id="input-agent1BrainOutputs", style="width: 100px; height: 3rem;", multiple>
            <option selected value="velocity">Velocity</option>
            <option selected value="angularVelocity">Angular Veloctiy</option>
        </select>
        <br>

        
        <label># of agent${n}: </label>
        <input id="input-numAgent1", style="width: 100px", type="number", min="0", step="1", value="20">

        <button>X</button>
        <hr>
    </div>
    `)
    agentContainer.appendChild(agentInfo);
    agentRays.push(agentInfo.childNodes[3]);
    agentFov.push(agentInfo.childNodes[9]);
    agentViewDistance.push(agentInfo.childNodes[15]);
    agentBrainInputs.push(agentInfo.childNodes[21]);
    agentBrainHiddenLayers.push(agentInfo.childNodes[27]);
    agentBrainOutputs.push(agentInfo.childNodes[33]);
    numAgents.push(agentInfo.childNodes[39]);

    console.log(agentInfo.childNodes[3]);
    //delete button
    agentInfo.childNodes[41].onclick = (e) => {
        e.target.parentElement.remove();
        agentRays = agentRays.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        agentFov = agentFov.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        agentViewDistance = agentViewDistance.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        agentBrainInputs = agentBrainInputs.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        agentBrainHiddenLayers = agentBrainHiddenLayers.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        agentBrainOutputs = agentBrainOutputs.filter((f) => f.parentElement.parentElement != e.target.parentElement);
        numAgents = numAgents.filter((f) => f.parentElement.parentElement != e.target.parentElement);
    }
}

inputAddObstacle.onclick = () => {
    ADDING_OBSTACLE = true;
    ADDING_KILL_ZONE = false;
}
inputAddKillZone.onclick = () => {
    ADDING_OBSTACLE = true;
    ADDING_KILL_ZONE = true;
}

function updateProperties(){
    GRID_LINES = inputGridlines.checked;
    BORDER = inputBorder.checked;
    VIEW_RAYCASTS = inputViewRaycasts.checked;
    world.killOnTouch = inputKillOnTouch.checked;
    world.killOnBorderTouch = inputKillOnBorderTouch.checked;
    world.borders = inputWorldBorders.checked;
    world.stepsPerGeneration = parseInt(inputStepsPerGen.value);
    world.repopulateGeneration = inputRepopulateCheckbox.checked;
    world.repopulateGenerationTo = parseInt(inputRepopulateAmount.value);

    if(parseInt(inputPlaybackSpeed.value) != PLAYBACK_SPEED){
        PLAYBACK_SPEED = parseInt(inputPlaybackSpeed.value);
        updateLoop();
    }
    inputRepopulateAmount.disabled = !inputRepopulateCheckbox.checked;
    render();
}

function createElementFromHTML(htmlString) {
    let div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  }

