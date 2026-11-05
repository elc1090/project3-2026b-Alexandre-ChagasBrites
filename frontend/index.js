const tabs = document.querySelectorAll("h1");
const main = document.querySelector("main");
const playButton = document.getElementById("playButton");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const userForm = document.getElementById("userForm");
const deleteButton = document.getElementById("deleteButton");
const signoffButton = document.getElementById("signoffButton");

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
        if (tab.dataset.section === "userForm") {
            getUserForm();
        }
    });
}

async function getUserForm() {
    userForm.reset();

    try {
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/me", { credentials: "include" });
        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }
        
        const result = await response.json();
        console.log(result);

        userForm.name.value = result.name || "";
        userForm.email.value = result.email || "";

    } catch (error) {
        console.log(error);
    }
}

playButton.addEventListener("click", () => {
    window.location.href = "/game/";
});

signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/signin", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: signinForm.username.value,
                password: signinForm.password.value
            }),
            credentials: "include"
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
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/signup", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: signupForm.username.value,
                name: signupForm.name.value,
                email: signupForm.email.value,
                password: signupForm.password.value
            }),
            credentials: "include"
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

userForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/me", {
            method: "PATCH",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: userForm.name.value,
                email: userForm.email.value,
                password: userForm.password.value
            }),
            credentials: "include"
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }

    } catch (error) {
        console.log(error);
    }
});

deleteButton.addEventListener("click", async (e) => {
    try {
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/me", {
            method: "DELETE",
            credentials: "include"
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }

    } catch (error) {
        console.log(error);
    }
});

signoffButton.addEventListener("click", async (e) => {
    try {
        const response = await fetch("https://project3-2026b-alexandre-chagas-bri-one.vercel.app/api/signoff", {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(`${response.status}: ${message}`);
        }

        userForm.reset();

    } catch (error) {
        console.log(error);
    }
});

window.addEventListener("load", () => {
    selectTab("playSection");
});
