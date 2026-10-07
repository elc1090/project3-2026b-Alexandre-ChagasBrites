const tabs = document.querySelectorAll("h1");
const sections = document.querySelectorAll("section");
const playButton = document.getElementById("playButton");

function selectTab(id) {
    for (const tab of tabs) {
        tab.style.color = tab.dataset.section === id ? "white" : "black";
    }
    for (const section of sections) {
        section.style.display = section.id === id ? "flex" : "none";
    }
}

for (const tab of tabs) {
    tab.addEventListener("click", () => { 
        selectTab(tab.dataset.section);
    });
}

playButton.addEventListener("click", () => {
    window.location.href = "game.html";
});

window.addEventListener("load", () => {
    selectTab("playSection");
});
