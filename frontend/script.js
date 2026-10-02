const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const game = {
    timestamp: undefined,
    accum: 0,

    input: {},
    assets: {},

    resources: {
        gold: {
            count: 0,
            texture: null
        },
        meat: {
            count: 0,
            texture: null
        },
        wood: {
            count: 0,
            texture: null
        }
    },
    objects: [],

    cursor: {
        x: 0,
        y: 0,
        texture: null
    },
    hotObject: null,
    activeObject: null
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
        } else if (type === "Font") {
            const font = new FontFace(path.family, path.source);
            game.assets[path] = await font.load();
            document.fonts.add(font);
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

async function loadResources() {
    loadAsset("Font", { family: "Patrick Hand", source: "url('assets/PatrickHand-Regular.ttf')" });
    loadAsset("Prefab", "assets/Prefabs/Particles/Dust1.json");
    game.resources.gold.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_03.png");
    game.resources.meat.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_04.png");
    game.resources.wood.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_02.png");
    game.cursor.texture = await loadAsset("Image", "assets/Images/UI Elements/Cursors/Cursor_04.png");
}

async function loadPrefab(x, y, path) {
    const prefab = await loadAsset("Prefab", path);
    const object = {
        prefab: prefab,
        alive: true,
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
}

function getObject(x, y, filter) {
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object === game.cursor) {
            continue;
        }
        let offsetX = x - (object.x - object.prefab.sizeX / 64 * 0.5);
        let offsetY = y - (object.y - object.prefab.sizeY / 64 * 0.5);
        if (offsetX >= 0.0 && offsetX < object.prefab.sizeX / 64 && offsetY >= 0.0 && offsetY < object.prefab.sizeY / 64 && filter(object)) {
            return object;
        }
    }
    return null;
}

function canInteract(object, targetObject) {
    if (object.prefab.unitType === "Pawn" && targetObject.prefab.type === "Resource" && targetObject.animation !== "Stump") {
        return true;
    } else {
        return false;
    }
}

function onStep(deltatime) {
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];

        if (object.prefab.type === "Unit" && object.prefab.unitType === "Pawn") {
            if (object.targetObject !== null && object.animation === "Interact") {
                if (object.actionTimer > 0.0) {
                    object.actionTimer -= Math.min(object.actionTimer, deltatime);
                } else {
                    if (object.targetObject.prefab.resourceType === "Sheep") {
                        game.resources.meat.count += 5;
                        object.targetObject.alive = false;
                        loadPrefab(object.targetObject.x, object.targetObject.y, "assets/Prefabs/Particles/Dust1.json");
                    } else if (object.targetObject.prefab.resourceType === "Tree") {
                        game.resources.wood.count += 5;
                        objectSetAnimation(object.targetObject, "Stump");
                        loadPrefab(object.targetObject.x, object.targetObject.y, "assets/Prefabs/Particles/Dust1.json");
                    }
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
                } else if (object.frame + frames >= animation.frameCount && object.prefab.type === "Particle") {
                    object.alive = false;
                } else {
                    object.frame = (object.frame + frames) % animation.frameCount;
                    object.frameTimer -= frames;
                    object.textureRegion.x = object.frame * (object.texture.width / animation.frameCount);
                }
            }
        }
    }   
    game.objects = game.objects.filter((object) => { return object.alive; });
}

function handleEvent(e) {
    const result = onEvent(e);
    if (result) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
    return true;
}

function onEvent(e) {
    let consumed = false;
    if (e instanceof MouseEvent && e.cursor !== null) {
        game.cursor.x = (e.clientX - canvas.width * 0.5) / 64;
        game.cursor.y = (e.clientY - canvas.height * 0.5) / 64;

        if (game.activeObject === null) {
            game.hotObject = getObject(game.cursor.x, game.cursor.y, (object) => {
                return object.prefab.type === "Unit";
            });
            if (e.type === "mousedown" && e.button === 0) {
                consumed = true;
                game.activeObject = game.hotObject;
            }
        } else if (game.activeObject.prefab.type === "Unit") {
            game.hotObject = getObject(game.cursor.x, game.cursor.y, (object) => {
                return object.prefab.type === "Unit" || canInteract(game.activeObject, object);
            });
            if (e.type === "mousedown" && e.button === 0) {
                consumed = true;
                game.activeObject = getObject(game.cursor.x, game.cursor.y, (object) => {
                    return object.prefab.type === "Unit";
                });
            } else if (e.type === "mousedown" && e.button === 2) {
                consumed = true;
                game.activeObject.targetObject = getObject(game.cursor.x, game.cursor.y, (object) => {
                    return canInteract(game.activeObject, object);
                });
                if (game.activeObject.targetObject === null) {
                    game.activeObject.targetX = game.cursor.x;
                    game.activeObject.targetY = game.cursor.y;
                    objectSetAnimation(game.activeObject, "Run");
                } else {
                    const offsetX = game.activeObject.targetObject.x - game.activeObject.x;
                    game.activeObject.targetX = game.activeObject.targetObject.x - Math.sign(offsetX);
                    if (Math.sign(offsetX) === 0.0) {
                        game.activeObject.targetX += game.activeObject.flip ? -1 : 1;
                    }
                    game.activeObject.targetY = game.activeObject.targetObject.y;
                    objectSetAnimation(game.activeObject, "Run");
                }
            }
        }
    }
    return consumed;
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

        if (game.hotObject == object || game.activeObject == object) {
            drawCursor(object);
        }

        ctx.save();
        ctx.translate(object.x, object.y);

        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.0 / 64.0;
        ctx.strokeRect(-object.prefab.sizeX / 64 * 0.5, -object.prefab.sizeY / 64 * 0.5, object.prefab.sizeX / 64, object.prefab.sizeY / 64);

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

    ctx.resetTransform();
    {
        ctx.fillStyle = "white";
        ctx.font = "64px Patrick Hand";
        ctx.fillText(`${game.resources.gold.count}`.padStart(3, "0"), 112, 80);
        ctx.fillText(`${game.resources.meat.count}`.padStart(3, "0"), 112, 144);
        ctx.fillText(`${game.resources.wood.count}`.padStart(3, "0"), 112, 208);
        ctx.drawImage(game.resources.gold.texture, 32, 32);
        ctx.drawImage(game.resources.meat.texture, 32, 96);
        ctx.drawImage(game.resources.wood.texture, 32, 160);
    }
}

function drawCursor(object) {
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.drawImage(game.cursor.texture,   3,   3, 21, 25, -object.prefab.sizeX / 64 * 0.5 -  9 / 64, -object.prefab.sizeY / 64 * 0.5 - 14 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.texture, 104,   3, 21, 25,  object.prefab.sizeX / 64 * 0.5 - 12 / 64, -object.prefab.sizeY / 64 * 0.5 - 14 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.texture,   3, 100, 21, 25, -object.prefab.sizeX / 64 * 0.5 -  9 / 64,  object.prefab.sizeY / 64 * 0.5 - 11 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.texture, 104, 100, 21, 25,  object.prefab.sizeX / 64 * 0.5 - 12 / 64,  object.prefab.sizeY / 64 * 0.5 - 11 / 64, 21 / 64, 25 / 64);
    ctx.restore();
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

window.addEventListener("mousemove", (e) => { return handleEvent(e); });
window.addEventListener("mousedown", (e) => { return handleEvent(e); });
window.addEventListener("mouseup", (e) => { return handleEvent(e); });
window.addEventListener("keydown", (e) => { game.input[e.key] = true; return handleEvent(e); });
window.addEventListener("keyup", (e) => { game.input[e.key] = false; return handleEvent(e); });
window.addEventListener("blur", (e) => { game.input = {}; });

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
    resizeCanvas();
    requestAnimationFrame(gameloop);
});

function getRandomPosition() {
    let x = Math.floor(Math.random() * 11) - 5;
    let y = Math.floor(Math.random() * 11) - 5;
    while (getObject(x, y, (object) => true) !== null) {
        x = Math.floor(Math.random() * 11) - 5;
        y = Math.floor(Math.random() * 11) - 5;
    }
    return { x: x, y: y };
}

async function loadLevel() {
    await loadResources();
    await loadPrefab(0.0, -4.0, "assets/Prefabs/Buildings/Castle.json");
    for (let i = 0; i < 5; i++) {
        const position = getRandomPosition();
        await loadPrefab(position.x, position.y, "assets/Prefabs/Units/Pawn.json");
    }
    for (let i = 0; i < 10; i++) {
        const position = getRandomPosition();
        const treePath = `assets/Prefabs/Terrain/Resources/Wood/Trees/Tree${Math.floor(Math.random() * 4 + 1)}.json`;
        await loadPrefab(position.x, position.y, treePath);
    }
    for (let i = 0; i < 10; i++) {
        const position = getRandomPosition();
        await loadPrefab(position.x, position.y, "assets/Prefabs/Terrain/Resources/Meat/Sheep.json");
    }
}

loadLevel();
