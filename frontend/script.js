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
    tilemap: {
        sizeX: 0,
        sizeY: 0,
        tilesets: [],
        tiles: []
    },
    objects: [],

    debug: false,
    camera: {
        x: 0,
        y: 0,
        dragging: false
    },
    cursor: {
        screenX: 0,
        screenY: 0,
        worldX: 0,
        worldY: 0,
        pointerTexture: null,
        targetTexture: null
    },
    drawOrder: [],
    hotObject: null,
    activeObject: null
};

// [(l << 3) | (t << 2) | (r << 1) | b];
const autotileGround = [
    { x: 192, y: 192 }, // 0000
    { x: 192, y:   0 }, // 0001
    { x:   0, y: 192 }, // 0010
    { x:   0, y:   0 }, // 0011
    { x: 192, y: 128 }, // 0100
    { x: 192, y:  64 }, // 0101
    { x:   0, y: 128 }, // 0110
    { x:   0, y:  64 }, // 0111
    { x: 128, y: 192 }, // 1000
    { x:  128, y:   0 }, // 1001
    { x:  64, y: 192 }, // 1010
    { x:  64, y:   0 }, // 1011
    { x: 128, y: 128 }, // 1100
    { x: 128, y:  64 }, // 1101
    { x:  64, y: 128 }, // 1110
    { x:  64, y:  64 }  // 1111
];

// [(h << 2) | (l << 1) | r];
const autotileWall = [
    { x: 512, y: 320 }, // 000
    { x: 320, y: 320 }, // 001
    { x: 448, y: 320 }, // 010
    { x: 384, y: 320 }, // 011
    { x: 512, y: 256 }, // 100
    { x: 320, y: 256 }, // 101
    { x: 448, y: 256 }, // 110
    { x: 384, y: 256 }, // 111
];

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
            if (prefab.type === "Unit") {
                prefab.avatar = await loadAsset("Image", prefab.avatar);
            }
            for (const animation of Object.values(prefab.animations)) {
                animation.texture = await loadAsset("Image", animation.texture);
            }
            game.assets[path] = prefab;
        } else if (type === "Tilemap") {
            const response = await fetch(path);
            if (!response.ok) {
                return null;
            }
            const tilemap = await response.json();
            for (let i = 0; i < tilemap.tilesets.length; i++) {
                tilemap.tilesets[i] = await loadAsset("Image", tilemap.tilesets[i]);
            }
            game.assets[path] = tilemap;
        }
    }
    return game.assets[path];
}

async function loadResources() {
    loadAsset("Font", { family: "Patrick Hand", source: "url('assets/PatrickHand-Regular.ttf')" });
    loadAsset("Prefab", "assets/Prefabs/Particles/Dust1.json");
    game.resources.gold.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_03.png");
    game.resources.meat.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_04.png");
    game.resources.wood.texture = await loadAsset("Image", "assets/Images/UI Elements/Icons/Icon_02.png");
    game.cursor.pointerTexture = await loadAsset("Image", "assets/Images/UI Elements/Cursors/Cursor_01.png");
    game.cursor.targetTexture = await loadAsset("Image", "assets/Images/UI Elements/Cursors/Cursor_04.png");
}

async function loadTilemap(path) {
    const tilemap = await loadAsset("Tilemap", path);
    game.tilemap = tilemap;
    game.camera.x = game.tilemap.sizeX * 0.5;
    game.camera.y = game.tilemap.sizeY * 0.5;
    game.drawOrder = [];
    for (let i = 0; i < game.tilemap.sizeY; i++) {
        game.drawOrder.push([]);
    }
}

async function loadPrefab(options, path) {
    const prefab = await loadAsset("Prefab", path);
    const object = {
        prefab: prefab,
        alive: true,
        health: prefab.health,
        x: options.x || 0,
        y: options.y || 0,
        z: options.z || 0,
        offsetX: 0,
        offsetY: 0,
        rotation: options.rotation || 0,
        flip: false,
        targetObject: null,
        targetX: options.x || 0,
        targetY: options.y || 0,
        actionTimer: 0,
        frame: 0,
        frameTimer: 0,
        animation: "",
        texture: null,
        textureRegion: { x: 0, y: 0, w: 0, h: 0 },
    };
    setObjectAnimation(object, "Idle");
    if (object.prefab.type === "Projectile") {
        object.velocityX = options.velocityX || 0;
        object.velocityY = options.velocityY || 0;
        object.velocityZ = options.velocityZ || 0;
    }
    if (object.prefab.type !== "Particle") {
        object.frame = Math.floor(Math.random() * object.prefab.animations[object.animation].frameCount);
    }
    if (object.prefab.resourceType === "Sheep") {
        object.actionTimer = Math.random() * 2.0 + 2.0;
    }
    game.objects.push(object);
}

function getTilemapHeight(x, y) {
    if (x < 0 || x >= game.tilemap.sizeX || y < 0 || y >= game.tilemap.sizeY) {
        return 0;
    }
    const tile = game.tilemap.tiles[Math.floor(x) + Math.floor(y) * game.tilemap.sizeX];
    return tile >= 1 ? tile - 1 : 0;
}

function getWorldObject(x, y, filter) {
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        let offsetX = x - (object.x - object.prefab.sizeX / 64 * 0.5);
        let offsetY = y - (object.y - object.prefab.sizeY / 64 * 0.5);
        if (offsetX >= 0.0 && offsetX < object.prefab.sizeX / 64 && offsetY >= 0.0 && offsetY < object.prefab.sizeY / 64 && filter(object)) {
            return object;
        }
    }
    return null;
}

function getScreenObject(x, y, filter) {
    let selectedObject = null;
    let selectedOffset = undefined;
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        let offsetX = x - ((object.x + object.prefab.selectionX / 64 - game.camera.x) * 64 + canvas.width  * 0.5);
        let offsetY = y - ((object.y - object.z + object.prefab.selectionY / 64 - game.camera.y) * 64 + canvas.height * 0.5);
        if (offsetX >= 0.0 && offsetX < object.prefab.selectionW && offsetY >= 0.0 && offsetY < object.prefab.selectionH && filter(object)) {
            const offset = Math.abs(offsetX - object.prefab.selectionW * 0.5) + Math.abs(offsetY - object.prefab.selectionH * 0.5) - (object.y + object.z);
            if (selectedObject === null || offset < selectedOffset) {
                selectedObject = object;
                selectedOffset = offset;
            }
        }
    }
    return selectedObject;
}

function screenToWorld(x, y) {
    return {
        x: (x - canvas.width * 0.5) / 64 + game.camera.x,
        y: (y - canvas.height * 0.5) / 64 + game.camera.y
    };   
}

function worldToScreen(x, y, w, h) {
    return {
        x: (x - game.camera.x) * 64 + canvas.width * 0.5,
        y: (y - game.camera.y) * 64 + canvas.height * 0.5,
        w: w * 64,
        h: h * 64
    };   
}

function getWorldPosition(x, y) {
    const position = { 
        x: (x - canvas.width  * 0.5) / 64 + game.camera.x,
        y: (y - canvas.height * 0.5) / 64 + game.camera.y,
        z: 0
    };
    for (let i = game.tilemap.tilesets.length - 1; i > 0; i--) {
        const height = getTilemapHeight(position.x, position.y + i);
        if (height == i) {
            position.y += i;
            position.z = i;
            break;
        }
    }
    return position;
}

function setObjectAnimation(object, animation) {
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

function canInteract(object, targetObject) {
    return (object.prefab.unitType === "Pawn" && targetObject.prefab.type === "Resource" && targetObject.health > 0) ||
        ((object.prefab.unitType === "Warrior" || object.prefab.unitType === "Archer") && targetObject.prefab.type === "Unit" && targetObject.health > 0);
}

function onStep(deltatime) {
    game.camera.x += ((game.input["ArrowRight"] || 0) - (game.input["ArrowLeft"] || 0)) * 8 * deltatime;
    game.camera.y += ((game.input["ArrowDown"] || 0) - (game.input["ArrowUp"] || 0)) * 8 * deltatime;
    game.camera.x = Math.max(0, Math.min(game.camera.x, game.tilemap.sizeX));
    game.camera.y = Math.max(-game.tilemap.tilesets.length + 1, Math.min(game.camera.y, game.tilemap.sizeY));

    // Pre Move
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object.prefab.type === "Unit") {
            if (object.targetObject !== null && object.prefab.unitType !== "Archer") {
                const offsetX = object.targetObject.x - object.x;
                object.targetX = object.targetObject.x - Math.sign(offsetX);
                if (Math.sign(offsetX) === 0.0) {
                    object.targetX += object.flip ? -1 : 1;
                }
                object.targetY = object.targetObject.y;
                if (object.animation == "Idle" && (object.x !== object.targetX || object.y !== object.targetY)) {
                    setObjectAnimation(object, "Run");
                }
            } else if (object.targetObject !== null && object.prefab.unitType === "Archer") {
                object.flip = (object.targetObject.x - object.x) < 0.0;
            }
            if (object.targetObject !== null && (object.animation === "Interact" || object.animation === "Attack1" || object.animation === "Shoot")) {
                if (object.actionTimer > 0.0) {
                    object.actionTimer -= Math.min(object.actionTimer, deltatime);
                } else if (object.animation === "Shoot") {
                    object.actionTimer = object.prefab.animations[object.animation].frameCount * 0.1;
                    const time = (8 + Math.sqrt(8 * 8 + 2 * 10 * (object.z - object.targetObject.z))) / 10.0;
                    const velocityX = (object.targetObject.x - object.x) / time;
                    const velocityY = (object.targetObject.y - object.y) / time;
                    loadPrefab({ x: object.x, y: object.y, z: object.z + 0.5, velocityX: velocityX, velocityY: velocityY, velocityZ: 8 }, "assets/Prefabs/Units/Arrow.json");
                } else if (object.x === object.targetX && object.y === object.targetY) {
                    object.targetObject.health--;
                    if (object.targetObject.health > 0) {
                        object.actionTimer = object.prefab.animations[object.animation].frameCount * 0.1;
                    } else {
                        if (object.targetObject.prefab.resourceType === "Sheep") {
                            game.resources.meat.count += 5;
                            object.targetObject.alive = false;
                        } else if (object.targetObject.prefab.resourceType === "Tree") {
                            game.resources.wood.count += 5;
                            setObjectAnimation(object.targetObject, "Stump");
                        } else if (object.targetObject.prefab.type === "Unit") {
                            object.targetObject.alive = false;
                        }
                        loadPrefab({ x: object.targetObject.x, y: object.targetObject.y, z: object.targetObject.z }, "assets/Prefabs/Particles/Dust1.json");
                        object.targetObject = null;
                    }
                }
            }
        } else if (object.prefab.type === "Resource" && object.prefab.resourceType === "Sheep") {
            if (object.x === object.targetX && object.y === object.targetY) {
                if (object.actionTimer > 0.0) {
                    object.actionTimer -= Math.min(object.actionTimer, deltatime);
                } else {
                    const action = Math.floor(Math.random() * 2.0);
                    if (action === 0) {
                        setObjectAnimation(object, object.animation === "Idle" ? "Grass" : "Idle");
                    } else {
                        object.targetX = object.x + Math.random() * 2.0 - 1.0;
                        object.targetY = object.y + Math.random() * 2.0 - 1.0;
                        object.targetX = Math.max(0, Math.min(object.targetX, game.tilemap.sizeX));
                        object.targetY = Math.max(0, Math.min(object.targetY, game.tilemap.sizeY));
                        setObjectAnimation(object, "Move");
                    }
                    object.actionTimer = object.animation === "Grass"
                        ? object.prefab.animations[object.animation].frameCount * 0.1
                        : Math.random() * 1.0 + 1.0;
                }
            }
        } else if (object.prefab.type === "Projectile") {
            object.velocityZ -= 10.0 * deltatime;
            object.x += object.velocityX * deltatime;
            object.y += object.velocityY * deltatime;
            object.z += object.velocityZ * deltatime;
            object.rotation = Math.atan2(-object.velocityZ + object.velocityY, object.velocityX);
            object.alive = object.z > getTilemapHeight(object.x, object.y);
        }
    }   

    // Move
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object.animation !== "Run" && object.animation !== "Move") {
            continue;
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
        object.x = Math.max(0, Math.min(object.x, game.tilemap.sizeX));
        object.y = Math.max(0, Math.min(object.y, game.tilemap.sizeY));
        object.z = getTilemapHeight(object.x, object.y);
    }   

    // Post Move
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object.targetObject !== null && ((object.x === object.targetX && object.y === object.targetY) || object.prefab.unitType === "Archer") && (object.animation !== "Interact" && object.animation !== "Attack1" && object.animation !== "Shoot")) {
            object.flip = object.targetObject.x - object.x < 0.0;
            if (object.prefab.unitType === "Pawn") {
                setObjectAnimation(object, "Interact");
            } else if (object.prefab.unitType === "Warrior") {
                setObjectAnimation(object, "Attack1");
            } else if (object.prefab.unitType === "Archer") {
                setObjectAnimation(object, "Shoot");
            }
            object.actionTimer = object.prefab.animations[object.animation].actionFrame * 0.1;
        } else if ((object.animation === "Run" || object.animation === "Move") && object.x === object.targetX && object.y === object.targetY) {
            setObjectAnimation(object, "Idle");
        }
    }   

    // Animate
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        if (object.frameTimer !== undefined) {
            object.frameTimer += deltatime / 0.1;
            if (object.frameTimer >= 1.0) {
                const animation = object.prefab.animations[object.animation];
                const frames = Math.floor(object.frameTimer);
                if (object.frame + frames >= animation.frameCount && (object.animation === "Interact" || object.animation === "Attack1") && (object.targetObject === null || (object.x !== object.targetX && object.y !== object.targetY))) {
                    setObjectAnimation(object, "Idle");
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
    if (e instanceof MouseEvent) {
        if (e.type === "mousedown" && e.button === 1) {
            consumed = true;
            game.camera.dragging = true;
        } else if (e.type === "mouseup" && e.button === 1) {
            consumed = true;
            game.camera.dragging = false;
        }
        if (game.camera.dragging) {
            game.camera.x -= e.movementX / 64;
            game.camera.y -= e.movementY / 64;
            game.camera.x = Math.max(0, Math.min(game.camera.x, game.tilemap.sizeX));
            game.camera.y = Math.max(-game.tilemap.tilesets.length + 1, Math.min(game.camera.y, game.tilemap.sizeY));
        }

        game.cursor.screenX = e.clientX;
        game.cursor.screenY = e.clientY;
        const worldPosition = getWorldPosition(game.cursor.screenX, game.cursor.screenY);
        game.cursor.worldX = worldPosition.x;
        game.cursor.worldY = worldPosition.y;

        if (game.activeObject === null) {
            game.hotObject = getScreenObject(game.cursor.screenX, game.cursor.screenY, (object) => {
                return object.prefab.type === "Unit";
            });
            if (e.type === "mousedown" && e.button === 0) {
                consumed = true;
                game.activeObject = game.hotObject;
            }
        } else if (game.activeObject.prefab.type === "Unit") {
            game.hotObject = getScreenObject(game.cursor.screenX, game.cursor.screenY, (object) => {
                return object.prefab.type === "Unit" || canInteract(game.activeObject, object);
            });
            if (e.type === "mousedown" && e.button === 0) {
                consumed = true;
                game.activeObject = getScreenObject(game.cursor.screenX, game.cursor.screenY, (object) => {
                    return object.prefab.type === "Unit";
                });
            } else if (e.type === "mousedown" && e.button === 2) {
                consumed = true;
                game.activeObject.targetObject = getScreenObject(game.cursor.screenX, game.cursor.screenY, (object) => {
                    return game.activeObject !== object && canInteract(game.activeObject, object);
                });
                if (game.activeObject.targetObject === null) {
                    game.activeObject.targetX = game.cursor.worldX;
                    game.activeObject.targetY = game.cursor.worldY;
                    setObjectAnimation(game.activeObject, "Run");
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
    ctx.translate(-game.camera.x, -game.camera.y);

    ctx.beginPath();
    ctx.strokeStyle = "#ffffff7f";
    ctx.lineWidth = 1.0 / 64.0;
    for (let i = 0; i <= game.tilemap.sizeY; i++) {
        ctx.moveTo(0, i);
        ctx.lineTo(game.tilemap.sizeX, i);
    }
    for (let i = 0; i <= game.tilemap.sizeX; i++) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, game.tilemap.sizeY);
    }
    ctx.stroke();

    drawWorld();

    ctx.resetTransform();
    ctx.fillStyle = "white";
    ctx.font = "64px Patrick Hand";
    ctx.fillText(`${game.resources.gold.count}`.padStart(3, "0"), 112, 80);
    ctx.fillText(`${game.resources.meat.count}`.padStart(3, "0"), 112, 144);
    ctx.fillText(`${game.resources.wood.count}`.padStart(3, "0"), 112, 208);
    ctx.drawImage(game.resources.gold.texture, 32, 32);
    ctx.drawImage(game.resources.meat.texture, 32, 96);
    ctx.drawImage(game.resources.wood.texture, 32, 160);
    ctx.drawImage(game.cursor.pointerTexture, 22, 17, 22, 30, game.cursor.screenX, game.cursor.screenY, 22, 30);
    if (game.activeObject !== null) {
        ctx.drawImage(game.activeObject.prefab.avatar, -16, canvas.height + 16 - game.activeObject.prefab.avatar.height);
    }
}

function drawWorld() {
    const drawSort = (a, b) => { return (a.y + a.z) - (b.y + b.z); };
    for (let i = 0; i < game.drawOrder.length; i++) {
        game.drawOrder[i] = [];
    }
    for (let i = 0; i < game.objects.length; i++) {
        const object = game.objects[i];
        const rect = worldToScreen(
            object.x - object.offsetX / 64,
            object.y - object.z - object.offsetY / 64,
            object.textureRegion.w / 64,
            object.textureRegion.h / 64
        );
        if (rect.x + rect.w < 0 || rect.x > canvas.width || rect.y + rect.h < 0 || rect.y > canvas.height) {
            continue;
        }
        const index = Math.max(0, Math.min(Math.floor(object.y), game.drawOrder.length - 1));
        game.drawOrder[index].push(object);
    }

    const minBounds = screenToWorld(0, 0);
    const maxBounds = screenToWorld(canvas.width, canvas.height);

    minBounds.x = Math.max(0, Math.floor(minBounds.x));
    minBounds.y = Math.max(0, Math.floor(minBounds.y));
    maxBounds.x = Math.min(game.tilemap.sizeX, Math.ceil(maxBounds.x));
    maxBounds.y = Math.min(game.tilemap.sizeY, Math.ceil(maxBounds.y + game.tilemap.tilesets.length - 1));

    for (let y = minBounds.y; y < maxBounds.y; y++) {
        for (let x = minBounds.x; x < maxBounds.x; x++) {
            const tile = game.tilemap.tiles[x + y * game.tilemap.sizeX];
            if (tile == 0) {
                continue;
            }
            drawTile(x, y, tile);
        }
        const drawArray = game.drawOrder[y];
        drawArray.sort(drawSort);
        for (let i = 0; i < drawArray.length; i++) {
            const object = drawArray[i];
            drawObject(object);
        }
    }

    minBounds.y = maxBounds.y;
    maxBounds.y = Math.min(game.drawOrder.length, maxBounds.y + game.tilemap.tilesets.length - 1);

    for (let y = minBounds.y; y < maxBounds.y; y++) {
        const drawArray = game.drawOrder[y];
        drawArray.sort(drawSort);
        for (let i = 0; i < drawArray.length; i++) {
            const object = drawArray[i];
            drawObject(object);
        }
    }
}

function drawTile(x, y, tile) {
    const tileset = game.tilemap.tilesets[tile - 1];
    const l = x == 0 ? 0 : game.tilemap.tiles[(x - 1) + y * game.tilemap.sizeX];
    const t = y == 0 ? 0 : game.tilemap.tiles[x + (y - 1) * game.tilemap.sizeX];
    const r = x == game.tilemap.sizeX - 1 ? 0 : game.tilemap.tiles[(x + 1) + y * game.tilemap.sizeX];
    const b = y == game.tilemap.sizeY - 1 ? 0 : game.tilemap.tiles[x + (y + 1) * game.tilemap.sizeX];

    if (tile > 1 && b < tile) {
        const h = tile > 2 || (l + r + b) > 0 ? 1 : 0;
        if (h === 1) {
            drawTile(x, y, tile - 1);
        }
        const position = autotileWall[(h << 2) | (l < tile ? 0 : 2) | (r < tile ? 0 : 1)];
        ctx.drawImage(tileset, position.x, position.y, 64, 64, x, y - tile + 2, 1, 1);
    }

    const position = autotileGround[(l < tile ? 0 : 8) | (t < tile ? 0 : 4) | (r < tile ? 0 : 2) | (b < tile ? 0 : 1)];
    const u = tile > 1 ? position.x + 320 : position.x;
    const v = position.y;
    ctx.drawImage(tileset, u, v, 64, 64, x, y - tile + 1, 1, 1);
}

function drawObject(object) {
    if (game.hotObject == object || game.activeObject == object) {
        drawCursor(object);
    }

    ctx.save();
    ctx.translate(object.x, object.y - object.z);

    if (game.debug) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.0 / 64.0;
        ctx.strokeRect(object.prefab.selectionX / 64, object.prefab.selectionY / 64, object.prefab.selectionW / 64, object.prefab.selectionH / 64);
        
        ctx.strokeStyle = "blue";
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
    }

    ctx.rotate(object.rotation);
    ctx.scale(object.flip ? -1.0 : 1.0, 1.0);
    ctx.translate(-object.offsetX / 64, -object.offsetY / 64);
    ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 64, object.textureRegion.h / 64);
    if (game.hotObject == object) {
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 64, object.textureRegion.h / 64);
    }

    ctx.restore();
}

function drawCursor(object) {
    ctx.save();
    ctx.translate(object.x, object.y - object.z);
    ctx.drawImage(game.cursor.targetTexture,   3,   3, 21, 25, -object.prefab.sizeX / 64 * 0.5 -  9 / 64, -object.prefab.sizeY / 64 * 0.5 - 14 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.targetTexture, 104,   3, 21, 25,  object.prefab.sizeX / 64 * 0.5 - 12 / 64, -object.prefab.sizeY / 64 * 0.5 - 14 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.targetTexture,   3, 100, 21, 25, -object.prefab.sizeX / 64 * 0.5 -  9 / 64,  object.prefab.sizeY / 64 * 0.5 - 11 / 64, 21 / 64, 25 / 64);
    ctx.drawImage(game.cursor.targetTexture, 104, 100, 21, 25,  object.prefab.sizeX / 64 * 0.5 - 12 / 64,  object.prefab.sizeY / 64 * 0.5 - 11 / 64, 21 / 64, 25 / 64);
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
    let x = Math.floor(Math.random() * game.tilemap.sizeX) + 0.5;
    let y = Math.floor(Math.random() * game.tilemap.sizeY) + 0.5;
    let tile = game.tilemap.tiles[Math.floor(x) + Math.floor(y) * game.tilemap.sizeX];
    while (tile === 0 || getWorldObject(x, y, (object) => true) !== null) {
        x = Math.floor(Math.random() * game.tilemap.sizeX) + 0.5;
        y = Math.floor(Math.random() * game.tilemap.sizeY) + 0.5;
        tile = game.tilemap.tiles[Math.floor(x) + Math.floor(y) * game.tilemap.sizeX];
    }
    let z = getTilemapHeight(x, y);
    return { x: x, y: y, z: z };
}

function generateLayer(width, height, death, birth, iter, prob) {
    const tiles = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            tiles.push(Math.random() < prob(x, y));
        }
    }
    for (let i = 0; i < iter; i++) {
        const neighbourCount = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let count = 0;
                count += x == 0 ? 0 : tiles[(x - 1) + (y + 0) * width];
                count += x == width - 1 ? 0 : tiles[(x + 1) + (y + 0) * width];
                count += y == 0 ? 0 : tiles[(x + 0) + (y - 1) * width];
                count += y == height - 1 ? 0 : tiles[(x + 0) + (y + 1) * width];
                count += x == 0 && y == 0 ? 0 : tiles[(x - 1) + (y - 1) * width];
                count += x == width - 1 && y == 0 ? 0 : tiles[(x + 1) + (y - 1) * width];
                count += x == 0 && y == height - 1 ? 0 : tiles[(x - 1) + (y + 1) * width];
                count += x == width - 1 && y == height - 1 ? 0 : tiles[(x + 1) + (y + 1) * width];
                neighbourCount.push(count);
            }
        }
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = tiles[x + y * width];
                const count = neighbourCount[x + y * width];
                tiles[x + y * width] = ((tile == 1 && count >= death) || count > birth) ? 1 : 0;
            }
        }
    }
    return tiles;
}

async function generateTilemap(sizeX, sizeY) {
    const tilemap = {
        sizeX: sizeX,
        sizeY: sizeY,
        tilesets: [ 
            await loadAsset("Image", "assets/Images/Terrain/Tileset/Tilemap_color1.png"),
            await loadAsset("Image", "assets/Images/Terrain/Tileset/Tilemap_color2.png"),
            await loadAsset("Image", "assets/Images/Terrain/Tileset/Tilemap_color3.png")
        ],
        tiles: generateLayer(sizeX, sizeY, 3, 4, 4, (x, y) => {
            return 1.0 - (Math.abs(x - sizeX * 0.5) / sizeX + Math.abs(y - sizeY * 0.5) / sizeY);
        })
    };

    for (let i = 1; i <= 2; i++) {
        const mountainLayer = generateLayer(sizeX, sizeY, 4, 4, 4, (x, y) => {
            return tilemap.tiles[x + y * sizeX] === i ? 0.4 + i * 0.05 : 0
        });
        for (let y = 0; y < sizeY; y++) {
            for (let x = 0; x < sizeX; x++) {
                if (tilemap.tiles[x + y * sizeX] == i && mountainLayer[x + y * sizeX] == 1) {
                    tilemap.tiles[x + y * sizeX] = i + 1;
                }
            }
        }
    }

    game.tilemap = tilemap;
    game.camera.x = tilemap.sizeX * 0.5;
    game.camera.y = tilemap.sizeY * 0.5;
    game.drawOrder = [];
    for (let y = 0; y < tilemap.sizeY; y++) {
        game.drawOrder.push([]);
    }

    const treeLayer = generateLayer(sizeX, sizeY, 4, 4, 4, () => 0.45);
    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            if (tilemap.tiles[x + y * sizeX] > 0 && treeLayer[x + y * sizeX] == 1) {
                const treePath = `assets/Prefabs/Terrain/Resources/Wood/Trees/Tree${Math.floor(Math.random() * 4 + 1)}.json`;
                await loadPrefab({ x: x + 0.5 + (Math.random() - 0.5) * 0.5, y: y + 0.5 + (Math.random() - 0.5) * 0.5, z: getTilemapHeight(x, y) }, treePath);
            }
        }
    }
}

async function loadLevel() {
    await loadResources();
    await generateTilemap(48, 24);

    //await loadPrefab({ x: 4.5, y: 3, z: 2 }, "assets/Prefabs/Buildings/Castle.json");
    for (let i = 0; i < 5; i++) {
        await loadPrefab(getRandomPosition(), "assets/Prefabs/Units/Pawn.json");
    }
    for (let i = 0; i < 5; i++) {
        await loadPrefab(getRandomPosition(), "assets/Prefabs/Units/Warrior.json");
    }
    for (let i = 0; i < 5; i++) {
        await loadPrefab(getRandomPosition(), "assets/Prefabs/Units/Archer.json");
    }
    for (let i = 0; i < 10; i++) {
        await loadPrefab(getRandomPosition(), "assets/Prefabs/Terrain/Resources/Meat/Sheep.json");
    }
}

loadLevel();
