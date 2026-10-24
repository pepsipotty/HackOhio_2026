import * as THREE from 'three';

// Model-local centimetres. Curves describe a bilateral posterior study fitted
// to Ch36's rest surface, not measured anatomical attachment coordinates.
export const regions = [
 {id:'upper-trap',name:'Upper trapezius',layer:'superficial',color:'#a66055',thickness:1.1,rows:[[141.3,.65,17.3],[145,.65,14],[149,.65,7],[154,.65,2.4]],note:'Descending fibers from the posterior neck toward the lateral shoulder. Part of the continuous trapezius.'},
 {id:'middle-trap',name:'Middle trapezius',layer:'superficial',color:'#a66055',thickness:.85,rows:[[133,.7,5],[137,.65,12],[141,.65,17.3]],note:'Transverse fibers toward the scapular spine. Overlies the rhomboids; use the deep layer to reveal them.'},
 {id:'lower-trap',name:'Lower trapezius',layer:'superficial',color:'#a66055',thickness:.65,rows:[[119,.65,1],[125,.65,3.5],[132,.65,6.5],[137,.65,11.8]],note:'Ascending fibers from the lower thoracic midline toward the scapular spine. The taper is intentionally slender.'},
 {id:'rhomboid-minor',name:'Rhomboid minor',layer:'deep',color:'#bd8264',thickness:.52,rows:[[139,1,5.8],[141,1,6.6],[143,1,5.3]],note:'Small deep band between the upper thoracic midline and the medial scapular border. Normally covered by trapezius.'},
 {id:'rhomboid-major',name:'Rhomboid major',layer:'deep',color:'#b77559',thickness:.75,rows:[[129,5.5,7.8],[132,2.8,9],[137,1,8],[139,1,6.2]],note:'Oblique fibers run inferolaterally to the medial scapular border. Shown in the deep and split views, below trapezius.'},
 {id:'latissimus',name:'Latissimus dorsi',layer:'superficial',color:'#a15c52',thickness:1.05,rows:[[102,3.8,8.2],[108,3,12],[116,1,15],[123,2.5,17],[129,9,18.4],[134,16,19]],note:'One broad fan per side. Upper and lower controls adjust regions of the same sheet; the humeral tendon is only suggested at the posterior axillary fold.'},
 {id:'infraspinatus',name:'Infraspinatus',layer:'both',color:'#bc7767',thickness:.8,rows:[[131,10.3,13],[134,8,17],[138,7.7,18],[140,11,16.5]],note:'Broad posterior scapular muscle below the scapular spine. Simplified here to the exposed posterior surface.'},
 {id:'teres-major',name:'Teres major',layer:'both',color:'#a86855',thickness:.65,rows:[[128,11.8,13.8],[130,11,17],[133,15,19]],note:'Short band along the inferior lateral scapular region toward the upper arm, above the latissimus fold.'},
 {id:'erectors',name:'Erector spinae',layer:'deep',color:'#ad7b60',thickness:.75,rows:[[103,1,3],[109,1,4],[119,1,3.5],[130,1,2.6],[139,1,1.5]],note:'Paired longitudinal columns, represented as a simplified group. Revealed with the deep layer rather than placed over the lats.'},
];
export const defaults=()=>Object.fromEntries(regions.map(r=>[r.id,{volume:1,width:1,shift:0,upper:1,lower:1}]));
function interpolate(rows,y,column){let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);const before=rows[Math.max(0,i-1)],after=rows[Math.min(rows.length-1,i+2)],span=b[0]-a[0];const m0=(b[column]-before[column])/(b[0]-before[0]),m1=(after[column]-a[column])/(after[0]-a[0]);return (2*t*t*t-3*t*t+1)*a[column]+(t*t*t-2*t*t+t)*span*m0+(-2*t*t*t+3*t*t)*b[column]+(t*t*t-t*t)*span*m1;}
function section(region,v,config){const y=THREE.MathUtils.lerp(region.rows[0][0],region.rows.at(-1)[0],v);let lo=interpolate(region.rows,y,1),hi=interpolate(region.rows,y,2);const center=(lo+hi)/2;lo=center+(lo-center)*config.width;hi=center+(hi-center)*config.width;return {y:y+config.shift,lo,hi};}
function relief(region,u,v,config){const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*u)),1.5)*Math.pow(Math.max(0,Math.sin(Math.PI*v)),1.35);const regional=region.id==='latissimus'?THREE.MathUtils.lerp(config.lower,config.upper,THREE.MathUtils.smoothstep(v,.25,.8)):1;return envelope*region.thickness*config.volume*regional;}

function surfacePoint(region,u,v,config){
 const s=section(region,v,config);let x=THREE.MathUtils.lerp(s.lo,s.hi,u),y=s.y;
 if(region.id==='middle-trap'){x=.65+16.65*u*config.width;y=THREE.MathUtils.lerp(132+.52*x,141.3,v)+config.shift;}
 if(region.id==='lower-trap'){x=.65+11.35*u*Math.pow(v,.85)*config.width;y=119+(132+.52*x-119)*v+config.shift;}
 return {x,y};
}

export function buildAnatomy(body){
 const original=body.geometry.attributes.position.array.slice();
 const pos=body.geometry.attributes.position,indices=body.geometry.index,weights=body.geometry.attributes.skinWeight,bones=body.geometry.attributes.skinIndex;
 const minX=-25,minY=98,step=.25,nx=201,ny=245;
 const depth=new Float32Array(nx*ny).fill(Infinity),face=new Int32Array(nx*ny).fill(-1),ba=new Float32Array(nx*ny),bb=new Float32Array(nx*ny);
 const tris=indices?indices.count:pos.count;
 const triIndices=t=>indices?[indices.getX(t),indices.getX(t+1),indices.getX(t+2)]:[t,t+1,t+2];
 for(let t=0;t<tris;t+=3){const [a,b,c]=triIndices(t);const ax=pos.getX(a),ay=pos.getY(a),bx=pos.getX(b),by=pos.getY(b),cx=pos.getX(c),cy=pos.getY(c);const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-8)continue;
 const x0=Math.max(0,Math.ceil((Math.min(ax,bx,cx)-minX)/step)),x1=Math.min(nx-1,Math.floor((Math.max(ax,bx,cx)-minX)/step));const y0=Math.max(0,Math.ceil((Math.min(ay,by,cy)-minY)/step)),y1=Math.min(ny-1,Math.floor((Math.max(ay,by,cy)-minY)/step));
 for(let iy=y0;iy<=y1;iy++)for(let ix=x0;ix<=x1;ix++){const x=minX+ix*step,y=minY+iy*step,A=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,B=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,C=1-A-B;if(A<-.00001||B<-.00001||C<-.00001)continue;const z=A*pos.getZ(a)+B*pos.getZ(b)+C*pos.getZ(c),k=iy*nx+ix;if(z<depth[k]){depth[k]=z;face[k]=t;ba[k]=A;bb[k]=B;}}
 }
 const limits=Array.from({length:ny},(_,iy)=>{let lo=nx,hi=0;for(let ix=0;ix<nx;ix++)if(face[iy*nx+ix]>=0){lo=Math.min(lo,ix);hi=Math.max(hi,ix);}return [minX+lo*step+.7,minX+hi*step-.7];});
 let misses=0;
 function sample(x,y){const row=THREE.MathUtils.clamp((y-minY)/step,0,ny-1.001),r0=Math.floor(row),rt=row-r0;const left=THREE.MathUtils.lerp(limits[r0][0],limits[r0+1][0],rt),right=THREE.MathUtils.lerp(limits[r0][1],limits[r0+1][1],rt);x=THREE.MathUtils.clamp(x,left,right);const gx=THREE.MathUtils.clamp((x-minX)/step,0,nx-1.001),gy=THREE.MathUtils.clamp((y-minY)/step,0,ny-1.001);const ix=Math.floor(gx),iy=Math.floor(gy),k=iy*nx+ix;let nearest=k;const candidates=[k,k+1,k+nx,k+nx+1].filter(q=>face[q]>=0);if(!candidates.length){misses++;let best=Infinity;for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){const q=(iy+dy)*nx+ix+dx;if(q>=0&&q<face.length&&face[q]>=0&&dx*dx+dy*dy<best){best=dx*dx+dy*dy;nearest=q;}}if(!Number.isFinite(best))throw Error(`No back surface at ${x}, ${y}`);}else nearest=candidates[0];
 let z=depth[nearest];if(candidates.length===4){const tx=gx-ix,ty=gy-iy;z=THREE.MathUtils.lerp(THREE.MathUtils.lerp(depth[k],depth[k+1],tx),THREE.MathUtils.lerp(depth[k+nx],depth[k+nx+1],tx),ty);}
 const vertexIds=triIndices(face[nearest]),bary=[ba[nearest],bb[nearest],1-ba[nearest]-bb[nearest]],combined=new Map();for(let j=0;j<3;j++)for(let slot=0;slot<4;slot++){const bone=bones.getComponent(vertexIds[j],slot),w=weights.getComponent(vertexIds[j],slot)*bary[j];combined.set(bone,(combined.get(bone)||0)+Math.max(0,w));}const top=[...combined].sort((a,b)=>b[1]-a[1]).slice(0,4);while(top.length<4)top.push([0,0]);const sum=top.reduce((s,p)=>s+p[1],0);return {x,z,indices:top.map(p=>p[0]),weights:top.map(p=>p[1]/sum)};
 }
 const textureCanvas=document.createElement('canvas');textureCanvas.width=256;textureCanvas.height=512;const ctx=textureCanvas.getContext('2d');ctx.fillStyle='#f3e7db';ctx.fillRect(0,0,256,512);for(let i=0;i<120;i++){ctx.strokeStyle=i%3?'rgba(95,39,29,.075)':'rgba(255,247,222,.22)';ctx.lineWidth=i%3?.7:1;ctx.beginPath();for(let y=0;y<=512;y+=8){const x=i*2.2+Math.sin(y/160+i*.6)*1.2;if(!y)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}const fiberTexture=new THREE.CanvasTexture(textureCanvas);fiberTexture.colorSpace=THREE.SRGBColorSpace;
 const patches=[];const U=28,V=52;
 for(const region of regions)for(const side of [-1,1]){const geometry=new THREE.BufferGeometry(),positions=[],uv=[],skinIndex=[],skinWeight=[],index=[];
 for(let j=0;j<=V;j++)for(let i=0;i<=U;i++){const u=i/U,v=j/V,s=surfacePoint(region,u,v,{width:1,shift:0}),x=side*s.x,hit=sample(x,s.y);positions.push(hit.x,s.y,hit.z);uv.push(region.id==='middle-trap'?v+u*.12:region.id==='upper-trap'?v*.7+u*.3:region.id==='lower-trap'?u*.7-v*.3:u,v);skinIndex.push(...hit.indices);skinWeight.push(...hit.weights);}
 for(let j=0;j<V;j++)for(let i=0;i<U;i++){const a=j*(U+1)+i,b=a+1,c=a+U+1,d=c+1;index.push(a,c,b,b,c,d);}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));geometry.setIndex(index);
 const material=new THREE.MeshStandardMaterial({color:region.color,map:fiberTexture,roughness:.72,side:THREE.DoubleSide});const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=`${side>0?'Left':'Right'}_${region.id}`;mesh.bind(body.skeleton,body.bindMatrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData={muscle:region.id,side:side>0?'left':'right',description:region.note};body.parent.add(mesh);patches.push({mesh,region,side});
 }
 function update(config,mode,layer,selected){for(const {mesh,region,side} of patches){const c=config[region.id];const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let j=0;j<=V;j++)for(let i=0;i<=U;i++){const u=i/U,v=j/V,s=surfacePoint(region,u,v,c),x=side*s.x,hit=sample(x,s.y),idx=j*(U+1)+i;const lift=.15+relief(region,u,v,c);p.setXYZ(idx,hit.x,s.y,hit.z-lift);si.setXYZW(idx,...hit.indices);sw.setXYZW(idx,...hit.weights);}p.needsUpdate=true;si.needsUpdate=true;sw.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();const deep=layer==='deep'||(layer==='split'&&side<0);mesh.visible=mode!=='skin'&&(region.layer==='both'||(deep?region.layer==='deep':region.layer==='superficial'));mesh.material.color.set(mode==='clay'?'#c3b49b':region.color);mesh.material.map=mode==='clay'?null:fiberTexture;mesh.material.emissive.set(region.id===selected?'#4e2515':'#000000');mesh.material.emissiveIntensity=.24;mesh.material.needsUpdate=true;}
 // Actual base-mesh displacement for the skin study, preserving vertex count,
 // topology, UVs and original skinning weights.
 const bp=body.geometry.attributes.position;
 for(let i=0;i<bp.count;i++){const x=original[i*3],y=original[i*3+1],z=original[i*3+2];let displacement=0;if(mode==='skin'&&Math.abs(x)<22&&y>102&&y<155&&z<0){for(const region of regions.filter(r=>r.layer!=='deep')){const c=config[region.id],ax=Math.abs(x);let v=(y-c.shift-region.rows[0][0])/(region.rows.at(-1)[0]-region.rows[0][0]),u;if(region.id==='middle-trap'){u=(ax-.65)/(16.65*c.width);v=(y-c.shift-(132+.52*ax))/(141.3-(132+.52*ax));}else if(region.id==='lower-trap'){v=(y-c.shift-119)/(13+.52*ax);u=(ax-.65)/(11.35*Math.pow(Math.max(0,v),.85)*c.width);}else{const s=section(region,v,c);u=(ax-s.lo)/(s.hi-s.lo);}if(v<=0||v>=1||u<=0||u>=1)continue;displacement=Math.max(displacement,relief(region,u,v,c));}displacement*=THREE.MathUtils.smoothstep(-z,0,4);}bp.setXYZ(i,x,y,z-displacement);}bp.needsUpdate=true;smoothNormals(body.geometry);body.geometry.computeBoundingSphere();
 }
 return {patches,update,fiberTexture,diagnostics:()=>({patches:patches.length,vertices:patches.reduce((n,p)=>n+p.mesh.geometry.attributes.position.count,0),surfaceFallbacks:misses,originalVertexCount:pos.count}),original};
}

// FBX triangles duplicate seam vertices. Average their normals without changing
// topology, UVs, bone weights, or the mannequin's separate parts.
export function smoothNormals(geometry){geometry.computeVertexNormals();const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();for(let i=0;i<p.count;i++){const key=`${Math.round(p.getX(i)*10000)},${Math.round(p.getY(i)*10000)},${Math.round(p.getZ(i)*10000)}`;let group=groups.get(key);if(!group){group={sum:new THREE.Vector3(),ids:[]};groups.set(key,group);}group.sum.x+=n.getX(i);group.sum.y+=n.getY(i);group.sum.z+=n.getZ(i);group.ids.push(i);}for(const g of groups.values()){g.sum.normalize();for(const i of g.ids)n.setXYZ(i,g.sum.x,g.sum.y,g.sum.z);}n.needsUpdate=true;}
