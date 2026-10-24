import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import './style.css';
const $=id=>document.getElementById(id);
const animationFree=new URLSearchParams(location.search).get('model')==='static';
const modelFile=animationFree?'Defeated_NoAnimation.fbx':'Defeated.fbx';
$('model-version').value=animationFree?'static':'animated';
$('model-version').onchange=()=>{const url=new URL(location.href);url.searchParams.set('model',$('model-version').value);location.assign(url);};
$('loading').textContent=`Loading ${modelFile}…`;
const stage=$('stage'), scene=new THREE.Scene();
scene.background=new THREE.Color('#e4e8e1');
const camera=new THREE.PerspectiveCamera(38,1,.01,100);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; stage.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.maxDistance=12;orbit.minDistance=1;orbit.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x64765b,2.5));
const light=new THREE.DirectionalLight(0xfff4e5,3);light.position.set(3,5,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=.025;scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe4e8e1,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(8,16,0xb4c1b3,0xcbd4c8);grid.position.y=-.01;scene.add(grid);
const gizmo=new TransformControls(camera,renderer.domElement);gizmo.setMode('rotate');gizmo.setSpace('local');gizmo.setSize(.7);scene.add(gizmo.getHelper());
let model,mixer,action,clips=[],playing=false,selected=null,skeleton;const joints=[],base=new Map(),offsets=new Map();
const quat=new THREE.Quaternion(),euler=new THREE.Euler();
function setPlaying(value){playing=value;$('play').textContent=value?'Pause':'Play';}
function stripOffsets(){for(const j of joints)if(base.has(j))j.quaternion.copy(base.get(j));}
function applyOffsets(){for(const j of joints){base.set(j,j.quaternion.clone());j.quaternion.multiply(offsets.get(j));}model?.updateMatrixWorld(true);}
function evaluate(){stripOffsets();mixer?.update(0);applyOffsets();}
function syncAxes(){if(!selected)return;euler.setFromQuaternion(offsets.get(selected),'XYZ');for(const axis of ['x','y','z']){const deg=THREE.MathUtils.radToDeg(euler[axis]);$('axis-'+axis).value=deg;$('value-'+axis).textContent=`${deg.toFixed(0)}°`;}}
function updateTime(){if(!action)return;$('timeline').value=action.time;$('time').textContent=`${action.time.toFixed(2)} / ${action.getClip().duration.toFixed(2)} s`;}
function chooseClip(index){stripOffsets();mixer.stopAllAction();action=mixer.clipAction(clips[index]);action.reset().play();mixer.update(0);applyOffsets();$('timeline').max=action.getClip().duration;updateTime();}
function selectJoint(){selected=joints.find(j=>j.name===$('joint').value)||null;if(selected)gizmo.attach(selected);else gizmo.detach();$('axes').hidden=!selected;syncAxes();}
gizmo.addEventListener('dragging-changed',ev=>{orbit.enabled=!ev.value;if(ev.value)setPlaying(false);});
gizmo.addEventListener('objectChange',()=>{if(!selected)return;quat.copy(base.get(selected)).invert().multiply(selected.quaternion);euler.setFromQuaternion(quat,'XYZ');for(const axis of ['x','y','z'])euler[axis]=THREE.MathUtils.clamp(euler[axis],-Math.PI/3,Math.PI/3);offsets.get(selected).setFromEuler(euler);selected.quaternion.copy(base.get(selected)).multiply(offsets.get(selected));syncAxes();});
for(const axis of ['x','y','z']){const label=document.createElement('label');label.className='axis-label';label.htmlFor='axis-'+axis;label.innerHTML=`${axis.toUpperCase()} rotation <output id="value-${axis}">0°</output>`;const input=document.createElement('input');input.id='axis-'+axis;input.type='range';input.min=-60;input.max=60;input.step=1;input.value=0;input.addEventListener('input',()=>{if(!selected)return;setPlaying(false);euler.setFromQuaternion(offsets.get(selected),'XYZ');euler[axis]=THREE.MathUtils.degToRad(Number(input.value));offsets.get(selected).setFromEuler(euler);evaluate();syncAxes();});$('axes').append(label,input);}
$('axes').hidden=true;
$('play').onclick=()=>setPlaying(!playing);$('joint').onchange=selectJoint;$('clip').onchange=()=>chooseClip(Number($('clip').value));$('timeline').oninput=()=>{setPlaying(false);stripOffsets();action.time=Number($('timeline').value);mixer.update(0);applyOffsets();updateTime();};$('reset').onclick=()=>{for(const q of offsets.values())q.identity();evaluate();syncAxes();};$('skeleton').onchange=()=>{skeleton.visible=$('skeleton').checked;};
function frame(){camera.position.set(3.1,1.9,4.5);orbit.target.set(0,1,0);orbit.update();}$('frame').onclick=frame;frame();
new ResizeObserver(()=>{const {width,height}=stage.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);}).observe(stage);
try{
 model=await new FBXLoader().loadAsync('/'+modelFile,ev=>{if(ev.total)$('loading').textContent=`Loading character… ${Math.round(ev.loaded/ev.total*100)}%`;});
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());model.scale.multiplyScalar(2/size.y);model.updateMatrixWorld(true);bounds.setFromObject(model);const center=bounds.getCenter(new THREE.Vector3());model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));scene.add(model);
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 for(const [suffix,label] of [['Head','Head'],['Spine2','Torso'],['LeftArm','Left upper arm'],['RightArm','Right upper arm'],['Hips','Hips']]){let bone;model.traverse(o=>{if(o.isBone&&o.name.endsWith(suffix))bone=o;});if(bone){joints.push(bone);offsets.set(bone,new THREE.Quaternion());const option=new Option(label,bone.name);$('joint').add(option);}}
 skeleton=new THREE.SkeletonHelper(model);skeleton.material.depthTest=false;skeleton.material.transparent=true;skeleton.material.opacity=.5;skeleton.visible=false;scene.add(skeleton);
 clips=model.animations.filter(c=>c.tracks.length>0);mixer=new THREE.AnimationMixer(model);clips.forEach((c,i)=>$('clip').add(new Option(`${c.name} · ${c.duration.toFixed(2)} s`,i)));
 if(clips.length){chooseClip(clips.findIndex(c=>c.name.includes('mixamo'))>=0?clips.findIndex(c=>c.name.includes('mixamo')):0);$('clip').value=clips.indexOf(action.getClip());}
 else{applyOffsets();$('clip').add(new Option('No embedded animation',''));$('time').textContent='Static pose';$('model-note').textContent='Animation-free rig. Use the five joint handles to pose the character. Preview only; changes are not saved.';}
 $('clip').disabled=!clips.length;$('speed').disabled=!clips.length;
 $('controls').disabled=false;$('play').disabled=!clips.length;$('timeline').disabled=!clips.length;$('loading').hidden=true;$('status').textContent=`${joints.length} handles · ${clips.length} clip${clips.length===1?'':'s'} loaded`;
 $('joint').value=joints.find(j=>j.name.endsWith('Head'))?.name||'';selectJoint();
 // Read-only diagnostic snapshot used by the local smoke check.
 window.previewState=()=>({clips:clips.map(c=>({name:c.name,duration:c.duration})),playing,time:action?.time,joints:joints.map(j=>({name:j.name,offset:offsets.get(j).toArray()})),selected:selected?.name});
}catch(error){console.error(error);$('loading').textContent='Unable to load the character. Reload this page to retry. '+error.message;$('status').textContent='Loading failed';}
let previous=performance.now();renderer.setAnimationLoop(now=>{const delta=Math.min((now-previous)/1000,.05);previous=now;if(playing&&mixer){stripOffsets();mixer.update(delta*Number($('speed').value));applyOffsets();updateTime();}orbit.update();renderer.render(scene,camera);});
