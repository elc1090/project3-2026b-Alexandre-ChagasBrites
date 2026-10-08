const tabs = document.querySelectorAll("h1");
const main = document.querySelector("main");
const playButton = document.getElementById("playButton");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");

function selectTab(id) {
    for (const tab of tabs) {
        tab.style.color = tab.dataset.section === id ? "white" : "black";
    }
    for (const section of main.children) {
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

signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const response = await fetch("http://localhost:3000/api/signin", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: signinForm.username.value,
                password: signinForm.password.value
            })
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }
        
        const result = await response.json();
        console.log(result);

    } catch (error) {
        console.log(error);
    }

    signinForm.reset();
});

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const response = await fetch("http://localhost:3000/api/signup", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: signupForm.username.value,
                email: signupForm.email.value,
                password: signupForm.password.value
            })
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }
        
        const result = await response.json();
        console.log(result);

    } catch (error) {
        console.log(error);
    }

    signupForm.reset();
});

window.addEventListener("load", () => {
    selectTab("playSection");
});
