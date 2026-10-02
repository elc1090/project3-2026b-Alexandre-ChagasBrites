const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const game = {
    timestamp: undefined,
    accum: 0,

    input: {},
    assets: {},

    resources: {
        gold: 0,
        meat: 0,
        wood: 0
    },
    objects: [],

    cursor: null,
    selectedObject: null
};

async function loadAsset(type, path) {
    if (game.assets[path] === undefined) {
        if (type === "Image") {
            const image = await new Promise((resolve, reject) => {
                let image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = path;
            });
            game.assets[path] = image;
        } else if (type === "Prefab") {
            const response = await fetch(path);
            if (!response.ok) {
                return null;
            }
            const prefab = await response.json();
            for (const animation of Object.values(prefab.animations)) {
                animation.texture = await loadAsset("Image", animation.texture);
            }
            game.assets[path] = prefab;
        }
    }
    return game.assets[path];
}

function objectSetAnimation(object, animation) {
    if (object.animation === animation) {
        return;
    }
    object.offsetX = object.prefab.animations[animation].offsetX;
    object.offsetY = object.prefab.animations[animation].offsetY;
    object.frame = 0;
    object.frameTimer = 0;
    object.animation = animation;
    object.texture = object.prefab.animations[animation].texture;
    object.textureRegion.x = 0;
    object.textureRegion.y = 0;
    object.textureRegion.w = object.texture.width / object.prefab.animations[animation].frameCount;
    object.textureRegion.h = object.texture.height;
}

async function loadCursor() {
    const object = {
        prefab: {},
        x: 0,
        y: 0,
        offsetX: 64,
        offsetY: 64,
        texture: await loadAsset("Image", "assets/Images/UI Elements/Cursors/Cursor_04.png"),
        textureRegion: { x: 0, y: 0, w: 128, h: 128 },
    };
    game.objects.push(object);
    game.cursor = object;
}

async function loadPrefab(x, y, path) {
    const prefab = await loadAsset("Prefab", path);
    const object = {
        prefab: prefab,
        x: x,
        y: y,
        offsetX: 0,
        offsetY: 0,
        flip: false,
        targetObject: null,
        targetX: x,
        targetY: y,
        actionTimer: Math.random() * 2.0 + 2.0,
        frame: 0,
        frameTimer: 0,
        animation: "",
        texture: null,
        textureRegion: { x: 0, y: 0, w: 0, h: 0 },
    };
    objectSetAnimation(object, "Idle");
    game.objects.push(object);

    if (game.selectedObject === null && object.prefab.type === "Unit") {
        game.selectedObject = object;
    }
}

function getObject(x, y) {
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object === game.cursor) {
            continue;
        }
        let offsetX = x - object.x;
        let offsetY = y - object.y;
        if (offsetX * offsetX + offsetY * offsetY < 0.25) {
            return object;
        }
    }
    return null;
}

function onStep(deltatime) {
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];

        if (object.prefab.type === "Unit" && object.prefab.unitType === "Pawn") {
            if (object.targetObject !== null && object.animation === "Interact") {
                if (object.actionTimer > 0.0) {
                    object.actionTimer -= Math.min(object.actionTimer, deltatime);
                } else {
                    objectSetAnimation(object.targetObject, "Stump");   
                    object.targetObject = null;
                }
            }
        } else if (object.prefab.type === "Resource" && object.prefab.resourceType === "Sheep") {
            if (object.x === object.targetX && object.y === object.targetY) {
                if (object.actionTimer > 0.0) {
                    object.actionTimer -= Math.min(object.actionTimer, deltatime);
                } else {
                    const action = Math.floor(Math.random() * 2.0);
                    if (action === 0) {
                        objectSetAnimation(object, object.animation === "Idle" ? "Grass" : "Idle");
                    } else {
                        object.targetX = object.x + Math.random() * 2.0 - 1.0;
                        object.targetY = object.y + Math.random() * 2.0 - 1.0;
                        objectSetAnimation(object, "Move");
                    }
                    object.actionTimer = object.animation === "Grass"
                        ? object.prefab.animations[object.animation].frameCount * 0.1
                        : Math.random() * 2.0 + 2.0;
                }
            }
        }

        let offsetX = object.targetX - object.x;
        let offsetY = object.targetY - object.y;
        if (offsetX * offsetX + offsetY * offsetY > 0.0) {
            if (offsetX !== 0.0) {
                object.x += Math.min(deltatime, Math.abs(offsetX)) * Math.sign(offsetX);
                object.flip = offsetX < 0.0;
            }
            if (offsetY !== 0.0) {
                object.y += Math.min(deltatime, Math.abs(offsetY)) * Math.sign(offsetY);
            }
            offsetX = object.targetX - object.x;
            offsetY = object.targetY - object.y;
        }

        if ((object.animation === "Run" || object.animation === "Move") && offsetX * offsetX + offsetY * offsetY === 0.0) {
            if (object.targetObject === null) {
                objectSetAnimation(object, "Idle");
            } else {
                object.flip = object.targetObject.x - object.x < 0.0;
                objectSetAnimation(object, "Interact");
                object.actionTimer = object.prefab.animations[object.animation].frameCount * 0.1 * 4 - 0.3;
            }
        }

        if (object.frameTimer !== undefined) {
            object.frameTimer += deltatime / 0.1;
            if (object.frameTimer >= 1.0) {
                const animation = object.prefab.animations[object.animation];
                const frames = Math.floor(object.frameTimer);
                if (object.frame + frames >= animation.frameCount && object.animation === "Interact" && object.targetObject === null) {
                    objectSetAnimation(object, "Idle");
                } else {
                    object.frame = (object.frame + frames) % animation.frameCount;
                    object.frameTimer -= frames;
                    object.textureRegion.x = object.frame * (object.texture.width / animation.frameCount);
                }
            }
        }
    }   
}

function onEvent(e) {
    if (e instanceof MouseEvent && e.cursor !== null) {
        game.cursor.x = (e.clientX - canvas.width * 0.5) / 64;
        game.cursor.y = (e.clientY - canvas.height * 0.5) / 64;

        if (game.selectedObject !== null && e.type === "mousedown") {
            game.selectedObject.targetObject = getObject(game.cursor.x, game.cursor.y);
            if (game.selectedObject.targetObject === game.selectedObject || (game.selectedObject.targetObject !== null && game.selectedObject.targetObject.prefab.type !== "Resource")) {
                game.selectedObject.targetObject = null;
            }
            if (game.selectedObject.targetObject === null) {
                game.selectedObject.targetX = game.cursor.x;
                game.selectedObject.targetY = game.cursor.y;
                objectSetAnimation(game.selectedObject, "Run");
            } else {
                const offsetX = game.selectedObject.targetObject.x - game.selectedObject.x;
                game.selectedObject.targetX = game.selectedObject.targetObject.x - Math.sign(offsetX);
                if (Math.sign(offsetX) === 0.0) {
                    game.selectedObject.targetX += game.selectedObject.flip ? -1 : 1;
                }
                game.selectedObject.targetY = game.selectedObject.targetObject.y;
                objectSetAnimation(game.selectedObject, "Run");
            }
        }
    }
}

function onRender() {
    ctx.reset();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#47ABA9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.resetTransform();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    ctx.scale(64, 64);
    
    game.objects.sort((a, b) => { return a.y - b.y; });
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        ctx.save();
        ctx.translate(object.x, object.y);

        ctx.strokeStyle = "red";
        ctx.lineWidth = 1.0 / 64.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(1, 0);
        ctx.stroke();

        ctx.strokeStyle = "green";
        ctx.lineWidth = 1.0 / 64.0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -1);
        ctx.stroke();

        ctx.scale(object.flip ? -1.0 : 1.0, 1.0);
        ctx.translate(-object.offsetX / 64, -object.offsetY / 64);
        ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 64, object.textureRegion.h / 64);
        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function gameloop(timestamp) {
    if (game.timestamp !== undefined) {
        const deltatime = timestamp - game.timestamp;
        onStep(deltatime / 1000.0);

        /*game.accum = Math.min(game.accum + deltatime, 100.0);
        while (game.accum >= 1000.0 / 60.0) {
            onStep(1.0 / 60.0);
            game.accum -= 1000.0 / 60.0;
        }*/
    }
    game.timestamp = timestamp;

    onRender();
    requestAnimationFrame(gameloop);
}

window.addEventListener("mousemove", (e) => { onEvent(e); });
window.addEventListener("mousedown", (e) => { onEvent(e); });
window.addEventListener("mouseup", (e) => { onEvent(e); });
window.addEventListener("keydown", (e) => { game.input[e.key] = true; onEvent(e); });
window.addEventListener("keyup", (e) => { game.input[e.key] = false; });
window.addEventListener("blur", (e) => { game.input = {}; });

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
    resizeCanvas();
    requestAnimationFrame(gameloop);
});

loadCursor();
loadPrefab(0.0, 0.0, "assets/Prefabs/Units/Pawn.json");
for (let i = 0; i < 10; i++) {
    const treePath = `assets/Prefabs/Terrain/Resources/Wood/Trees/Tree${Math.floor(Math.random() * 4 + 1)}.json`;
    loadPrefab(Math.floor(Math.random() * 11) - 5, Math.floor(Math.random() * 11) - 5, treePath);
    loadPrefab(Math.floor(Math.random() * 11) - 5, Math.floor(Math.random() * 11) - 5, "assets/Prefabs/Terrain/Resources/Meat/Sheep.json");
}
