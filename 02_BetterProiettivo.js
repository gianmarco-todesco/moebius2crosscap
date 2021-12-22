MYLIB.initialize('renderCanvas', populateScene);

// surface front color
const srfColor1 = new BABYLON.Color3(0.2,0.8,0.8);

// surface back color
const srfColor2 = new BABYLON.Color3(0.8,0.2,0.8);

// surface common color
const srfColor3 = new BABYLON.Color3(0.8,0.2,0.8);

// border color
const borderColor = new BABYLON.Color3(0.1,0.1,0.1);

//
// global variables
// 
let colorParameter = 0; // 0 => two colors; 1 => one color

// materials
let srfMaterial1, srfMaterial2;

let grid;
let useTwoColors = true;

// current parameter : 0.0 = shape1, 1.0 = shape2
let currentParam = 0.0;

//
// GUI callbacks
//
function setParam(param) {
    currentParam = Math.max(0, Math.min(1, param*0.01));
}

function showGridChanged(cb) {
    grid.isVisible = cb.checked;
}
function useTwoColorsChanged(cb) {
    useTwoColors = cb.checked;
}

//
// handle color change
//
function updateColors() {
    if(useTwoColors) {
        if(colorParameter <= 0.0) return;
        colorParameter = Math.max(0.0, colorParameter - 0.1);
    } else {
        if(colorParameter >= 1.0) return;
        colorParameter = Math.min(1.0, colorParameter + 0.1);
    }
    let t = colorParameter;
    srfMaterial1.diffuseColor.copyFrom(BABYLON.Color3.Lerp(srfColor1, srfColor3, t));
    srfMaterial2.diffuseColor.copyFrom(BABYLON.Color3.Lerp(srfColor2, srfColor3, t));
}

// 
// Surface class : contain surface mesh and border mesh
//
class Surface {

    // ctor 
    //   f(u,v,t) : define the surface; 
    //              u,v in [0..1]; t in [0..1] (control shape transform)
    //              Note: border = f(0,v,t), v=[0..2]
    //   nu,nv    : number of surface points
    //   nb       : number of border points     
    constructor(f, nu, nv, nb, scene) {
        this.nu = nu;
        this.nv = nv;
        this.nb = nb;

        this._buildSurface(f, scene);
        this._buildBorder(f, scene)
    }

    // update the shape
    update(f) {
        this._updateSurface(f);
        this._updateBorder(f);
    }

    _buildSurface(f, scene) {
        const nu = this.nu;
        const nv = this.nv;
        let vd = new BABYLON.VertexData();
        vd.positions = [];
        vd.uvs = [];
        vd.indices = [];
        vd.normals = [];
        for(let side = 0; side<2; side++)
        {
            for(let i=0; i<nu; i++) {
                let u = i/(nu-1);
                for(let j=0;j<nv; j++) {
                    let v = j/(nv-1);
                    let p = f(u,v);
                    vd.positions.push(p.x,p.y,p.z);
                    vd.uvs.push(u,v);
                    let norm = this.computeNormal(f, u,v).scale(1 - side*2);
                    vd.normals.push(norm.x,norm.y,norm.z);
                }
            }    
        
            for(let i=0; i+1<nu; i++) {
                for(let j=0;j+1<nv; j++) {
                    let k = side * nu*nv + i*nv+j;
                    if(side==0) vd.indices.push(k,k+1+nv,k+1, k,k+nv,k+1+nv);
                    else vd.indices.push(k, k+1,k+1+nv, k,k+1+nv,k+nv);
                }
            }
        }
    
        let mesh = this.mesh = new BABYLON.Mesh('surface', scene);
        vd.applyToMesh(mesh, true);
        let vCount = Math.floor(mesh.getTotalVertices()/2);
        let idxCount = Math.floor(mesh.getTotalIndices()/2);
        mesh.submeshes = [];        
        new BABYLON.SubMesh(0, 0, vCount, 0, idxCount, mesh);
        new BABYLON.SubMesh(1, 0, vCount, idxCount, idxCount, mesh);
    }

    _buildBorder(f, scene) {
        this.border = BABYLON.MeshBuilder.CreateTube('a', {
            path:this._createBorderPts(f),
            radius: 0.05,
            updatable: true,
        }, scene);
    }


    computeNormal(f,u,v) {
        const h = 0.001;
        let dfdu = f(u+h,v).subtract(f(u-h,v));
        let dfdv = f(u,v+h).subtract(f(u,v-h));
        return BABYLON.Vector3.Cross(dfdv,dfdu).normalize();
    }

    _updateSurface(f) {
        const { mesh, nu, nv } = this;
        let positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        let normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        let pi = 0;
        let ni = 0;
        for(let i=0; i<nu; i++) {
            let u = i/(nu-1);
            for(let j=0;j<nv; j++) {
                let v = j/(nv-1);
                let p = f(u,v);
                positions[pi] = p.x;
                positions[pi+1] = p.y;
                positions[pi+2] = p.z;
                pi+=3;
                let norm = this.computeNormal(f, u,v);

                normals[ni] = norm.x;
                normals[ni+1] = norm.y;
                normals[ni+2] = norm.z;
                ni+=3;
            }
        }
        let d = nu*nv*3;
        for(let i=0; i<d; i++) 
        {
            positions[d+i] = positions[i];
            normals[d+i] = -normals[i];
        }
        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);    
    }

    _updateBorder(f) {
        this.border = BABYLON.MeshBuilder.CreateTube('a', {
            path: this._createBorderPts(f),
            instance: this.border
        });
    }


    _createBorderPts(f) {
        let pts = [];
        for(let i=0; i<this.nb; i++) {
            pts.push(f(0,2*i/(this.nb-1)))
        }
        return pts;
    }
}

//
// createGridTexture()
// (currently not used)
//
function createGridTexture(scene) {
    let tx = new BABYLON.DynamicTexture('dt', {width:1024, height:1024}, scene);
    let ctx = tx.getContext('2d');
    ctx.fillStyle = 'magenta';
    ctx.fillRect(0,0,1024,1024);
    ctx.fillStyle = 'white';
    const mi = 7, mj = 32;
    const dx = 1024 / mj, dy = 1024 / mi;
    for(let i=0;i<mi;i++) {
        for(let j=0;j<mj;j++) {
            if((i+j)&1) ctx.fillRect(j*dx,i*dy,dx,dy);
        }
    }
    //ctx.fillStyle = 'black';
    //for(let i=0;i<1024;i+=64) {
    //    ctx.fillRect(0,i,1024,6);
    //    ctx.fillRect(i,0,6,1024);        
    //}

    tx.update();
    tx.hasAlpha = true;
    return tx;    
}


// 
// populateScene()
//
// create grid and surface
// register animation function
//
function populateScene(scene) {
    grid = MYLIB.createGrid(scene);

    let srf = new Surface((u,v) => F(u,v,0), 70,70, 200, scene);
    window.srf=srf;

    assignMaterials(scene);   

    scene.registerBeforeRender(() => {
        updateColors();
        let t = performance.now() * 0.001;
        let param = t / 10.0; // 3sec period
        param = param - Math.floor(param);
        param = MYLIB.step(param,0.1,0.4) - MYLIB.step(param,0.6,0.8);
        srf.update((u,v) => F(u,v,currentParam))
    });
}

function assignMaterials(scene) {
    srfMaterial1 = new BABYLON.StandardMaterial('front-mat', scene);
    srfMaterial1.backFaceCulling = true;
    srfMaterial1.twoSidedLighting = false;
    srfMaterial1.diffuseColor.copyFrom(srfColor1);
    srfMaterial1.specularColor.set(0.1,0.1,0.1);

    srfMaterial2 = new BABYLON.StandardMaterial('back-mat', scene);
    srfMaterial2.backFaceCulling = true;
    srfMaterial2.twoSidedLighting = false;
    srfMaterial2.diffuseColor.copyFrom(srfColor2);
    srfMaterial2.specularColor.set(0.1,0.1,0.1);
   
    let material = srf.mesh.material = new BABYLON.MultiMaterial('mat', scene);
    material.subMaterials.push(srfMaterial1)
    material.subMaterials.push(srfMaterial2)

    
    let borderMat = new BABYLON.StandardMaterial('border-mat', scene);
    borderMat.diffuseColor.copyFrom(borderColor);
    borderMat.specularColor.set(0.1,0.1,0.1);
    srf.border.material = borderMat;

    //material.diffuseTexture = createGridTexture(scene);
    //material.useAlphaFromDiffuseTexture = true;
}

// ------------------------------------------------------------------
//
// surface function
//    F(u,v,t)
//    u = [0..1], v = [0..1], t = [0..1]
// 
// Note: border = {F(0,v,t) v = [0..2]}
//
// ------------------------------------------------------------------

function F(u,v,t) {
    // u = [0..1], v = [0..1], t = [0..1]
    
    // definisco due costanti: 
    // R0 è il raggio del cerchio che sta al centro del nastro di moebius
    // R1 è la (semi)larghezza del nastro
    const R0 = 3, R1 = 2;

    let pi = (Math.PI);
    let T = pi*2;
    let a, b;
    let x, y, z;

    a = Math.sin(u*pi);
    b = Math.cos(u*pi);

    x = a * Math.cos(v*T*t);
    y = b;
    z = a * Math.sin(v*T*t);

    //aggiungo la torsione prima che si chiuda
    let TC, TS;
    if (v*t<1/2)
    {
        TC = 1;
        TS = 1;
    }
    else
    {
        let V = (1-v*t)*2;
        TC = - Math.cos(V*T/2); 
        TS = Math.sin(V*T/2);
    }
    
    y = y*TC;
    z = z*TS;   

    // la funzione ritorna il punto (x,y,z)
    return new BABYLON.Vector3(x,y,z);
}