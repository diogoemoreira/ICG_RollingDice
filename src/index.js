import THREE, { OrbitControls } from "./three";
import CANNON from "cannon";
import { DiceManager, DiceD20, DiceD12, DiceD10, DiceD8, DiceD6, DiceD4 } from "../lib/dice";
import { Loader, TextureLoader } from "three";

// standard global variables
let scene,
	camera,
	renderer,
	controls,
	world,
	changeDice,
	loader,
	SCREEN_WIDTH = window.innerWidth,
	SCREEN_HEIGHT = window.innerHeight,
	diceMax=20,
	currentDice=0,
	noDice=1,
	dice = [],
	diceO = [];

init();

// FUNCTIONS
function init() {	
	// SCENE
	scene = new THREE.Scene();
	// CAMERA
	camera = new THREE.PerspectiveCamera(75, SCREEN_WIDTH / SCREEN_HEIGHT, 0.01, 20000);
	scene.add(camera);
	camera.position.set(0, 30, 30);

	// RENDERER
	renderer = new THREE.WebGLRenderer({ antialias: true });
	
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	document.getElementById("Tag3DScene").appendChild( renderer.domElement ); //div is necessary to adjust correctly to screen
	
	// CONTROLS
	controls = new OrbitControls(camera, renderer.domElement);

	//LIGHTS
	let ambient = new THREE.AmbientLight("#bbbbff", 0.3);
	scene.add(ambient);

	let light = new THREE.SpotLight(0xefdfd5, 1.3);
	light.position.x = -50;	
	light.position.y = 75;
	light.position.z = -25;
	light.target.position.set(0, 0, 0);
	light.castShadow = true;
	light.shadow.mapSize.width = SCREEN_WIDTH;
	light.shadow.mapSize.height = SCREEN_HEIGHT;
	scene.add(light);
	/*
	let light_helper = new THREE.SpotLightHelper(light);
	scene.add(light_helper);
	*/
	//TEXTURE LOADER
	loader = new THREE.TextureLoader();
	loader.crossOrigin = '';

	// FLOOR
	//loaded image from the internet because it was blocked when trying to load it locally
	var floorMaterial = new THREE.MeshPhongMaterial({
		map: loader.load('https://img.freepik.com/free-photo/empty-poker-table-casino_131286-84.jpg?size=626&ext=jpg'),
		side: THREE.DoubleSide
	});
	var floorGeometry = new THREE.PlaneBufferGeometry(50, 40, 10, 10);
	var floor = new THREE.Mesh(floorGeometry, floorMaterial);
	floor.receiveShadow = true;
	floor.rotation.x = Math.PI / 2;
	scene.add(floor);
	
	// SKYBOX
	var skyBoxGeometry = new THREE.BoxBufferGeometry(10000, 10000, 10000);
	var skyBoxMaterial = new THREE.MeshPhongMaterial({
		map: loader.load('https://i.imgur.com/ZNMUv9j.jpg'),
		side: THREE.BackSide
	});
	var skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
	scene.add(skyBox);
	scene.fog = new THREE.FogExp2(0x000000, 0.00025);

	//
	//World
	world = new CANNON.World();

	world.gravity.set(0, -9.82 * 20, 0);
	world.broadphase = new CANNON.NaiveBroadphase();
	world.solver.iterations = 16;

	DiceManager.setWorld(world);

	//Floor
	let floorBody = new CANNON.Body({
		mass: 0,
		shape: new CANNON.Plane(),
		material: DiceManager.floorBodyMaterial
	});
	floorBody.quaternion.setFromAxisAngle(
		new CANNON.Vec3(1, 0, 0),
		-Math.PI / 2
	);
	world.add(floorBody);

	//Walls
	createWall(1,5,41, -25, 2.5, 0);
	createWall(1,5,41, 25, 2.5, 0);
	createWall(50,5,1, 0, 2.5, -20);
	createWall(50,5,1, 0, 2.5, 20);

	//DICE
	createDice();

	// EVENTS
	document.addEventListener("click", randomDiceThrow);
	
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('keyup', onKeyUp);
	
	//

	requestAnimationFrame(animate);
}

function animate() {
	if(changeDice){
		for (var i = 0; i < 5; i++) { //until 5 cus its the max number of dice
			scene.remove(diceO.pop());
			dice.pop();//pop the die from the array
		}
		switch(currentDice){
			case 0:
				diceMax=20;
				createDice(DiceD20);
				break;
			case 1:
				diceMax=12;
				createDice(DiceD12);
				break;
			case 2:
				diceMax=10;
				createDice(DiceD10);
				break;
			case 3:
				diceMax=8;
				createDice(DiceD8);
				break;
			case 4:
				diceMax=6;
				createDice(DiceD6);
				break;
			case 5:
				diceMax=4;
				createDice(DiceD4);
				break;
		}			
	}
	
	updatePhysics();
	render();
	update();

	requestAnimationFrame(animate);

}

function updatePhysics() {
	world.step(1.0 / 60.0);

	for (var i in dice) {
		dice[i].updateMeshFromBody();
	}
}

function update() {
	controls.update();
}

function render() {
	renderer.render(scene, camera);
}

function createWall(width, height, depth, x,y,z) {
	//create the surrounding walls
	//need cannon so when the dice hit the wall they bounce
	let barrier = new CANNON.Body({
		mass: 0,
		shape: new CANNON.Box(new CANNON.Vec3(width, height, depth))
	});
	barrier.position.set(x, y, z);
	world.addBody(barrier);

	let wall = new THREE.Mesh(
		new THREE.BoxBufferGeometry(width, height, depth),
		new THREE.MeshPhongMaterial({
			map: loader.load('https://i.imgur.com/KCyiI2K.jpg'),
			side: THREE.DoubleSide
		})
	);
	wall.quaternion.set(
		barrier.quaternion.x,
		barrier.quaternion.y,
		barrier.quaternion.z,
		barrier.quaternion.w
	);
	wall.position.set(
		barrier.position.x,
		barrier.position.y,
		barrier.position.z
	);
	wall.castShadow = true;
	wall.receiveShadow = true;
	scene.add(wall);

}

function createDice(diceType=DiceD20){
	var colors = ["#ff0000", "#ffff00", "#00ff00", "#0000ff", "#ff00ff"]; //only goes up to 5 colors (more dice will come as black)

	for (var i = 0; i < noDice; i++) {
		var die = new diceType({ size: 1.5, backColor: colors[i] }); //create new Dice with a different color
		die.name = "AllDice"+i;
		scene.add(die.getObject()); //add die to the scene
		diceO.push(die.getObject()); //save die object (to make removal possible)
		dice.push(die); //push the new die to the array
	}

	randomDiceThrow();
}

function randomDiceThrow() {
	var diceValues = [];

	for (var i = 0; i < dice.length; i++) {
		let yRand = Math.random() * 20;
		//choosing position of the die when it is thrown
		dice[i].getObject().position.x = -15 - (i % 3) * 1.5;
		dice[i].getObject().position.y = 2 + Math.floor(i / 3) * 1.5;
		dice[i].getObject().position.z = -15 + (i % 3) * 1.5;
		//
		//for the dies's rotation
		dice[i].getObject().quaternion.x =
				((Math.random() * 90 - 45) * Math.PI) / 180;
		dice[i].getObject().quaternion.z =
			((Math.random() * 90 - 45) * Math.PI) / 180;
		//
		dice[i].updateBodyFromMesh();
		//add random velocity to the die
		let rand = Math.random() * 5;
		dice[i]
			.getObject()
			.body.velocity.set(25 + rand, 40 + yRand, 15 + rand);
		dice[i]
			.getObject()
			.body.angularVelocity.set(
				20 * Math.random() -10, 
				20 * Math.random() -10, 
				20 * Math.random() -10
			);
		//
	    //calculate die's value
		let v = Math.ceil(Math.random() * diceMax);
		diceValues.push({ dice: dice[i], value: v });
		console.log(v);
	}

	DiceManager.prepareValues(diceValues);
}

function onKeyDown(event) {
	switch(event.keyCode) {
		//increase/decrease number of dice
		case 40: 
			if (noDice <= 1){break;}
			noDice--;
			changeDice=true;
			break;
		case 38:
			if (noDice >= 5){break;}
			noDice++;
			changeDice=true;
			break;

		//change the type of the dice	
		case 39: // right
			//changes to the next die
			console.log("next dice "+currentDice);
			++currentDice;
			if(currentDice > 5){
				currentDice = 0;
			}
			changeDice = true;
			break;
		case 37: // left
			//changes to the previous die
			console.log("previous dice "+currentDice);
			--currentDice;
			if(currentDice < 0){
				currentDice = 5;
			}
			changeDice = true;
			break;
	}
}

function onKeyUp(event) {
	switch(event.keyCode) {
		case 40: //down
			changeDice=false;
			break;
		case 38: //up
			changeDice=false;
			break;

		case 39: // right
			changeDice = false;
			break;
		case 37: // left
			changeDice = false;
			break;
	}
}

