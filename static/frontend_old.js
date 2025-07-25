const MAX_INPUT_LENGTH = 20;
const MAX_AGE = 120;
const MAX_PASSWORD_LENGTH = 30;
const MAX_USERNAME_LENGTH = 30;

const emotions_h = ["Anger", "Disgust", "Fear", "Happiness", "Neutral", "Sadness", "Surprise"]; // Emotions and theirs numbers 
const emotions_h_l = {"0": "A", "1": "D", "2": "F", "3": "H", "4": "N", "5": "Sa", "6": "Su"};

// app.js
const host = "10.4.12.114"


let currentSection = document.querySelector('section.active');

function showSection(id) {
  const newSection = document.getElementById(id);
  if (newSection === currentSection) return;

  // Prepare new off-screen section on the right
  newSection.classList.remove('exit-left', 'exit-right', 'active');
  newSection.style.transform = 'translateX(100%)';
  newSection.style.opacity = '0';
  newSection.style.pointerEvents = 'none';

  // Force the browser to recognize the style change
  void newSection.offsetWidth; 

  // Moves the old section to the left
  currentSection.style.transform = 'translateX(-100%)';
  currentSection.style.opacity = '0';
  currentSection.style.pointerEvents = 'none';

  // Displays new section with transition
  newSection.classList.add('active');
  newSection.style.transform = 'translateX(0)';
  newSection.style.opacity = '1';
  newSection.style.pointerEvents = 'auto';

  setTimeout(() => {
    currentSection.classList.remove('active');
    currentSection = newSection;
  }, 600); 
}


document.addEventListener("DOMContentLoaded", () => {   // Wait until the HTML content is fully loaded before executing anything

  const form = document.getElementById("userForm");
  form.addEventListener("submit", function (event) {
    event.preventDefault(); 

    //Clear any previous validation warnings
    document.querySelectorAll(".field-warning").forEach(e => e.remove());
    let valid = true;



    const ageEl = document.getElementById("age");
    const age = parseInt(ageEl.value); 
    if (isNaN(age) || age <= 0 || age > MAX_AGE) {// Ensures age is a valid positive number within range
      showWarning(ageEl, `Age must be between 1 and ${MAX_AGE}`);
      valid = false;
    }

    if (!valid) return; 

    const sex = document.getElementById("sex").value;
    const emotion_true = document.getElementById("emotion_true").value;

    // Build the data object expected by the backend 
    const predictionData = {
      age: age,
      sex: sex,
      gad7_anxiety: parseInt(document.getElementById("gad7_anxiety").value),
      phq9depression: parseInt(document.getElementById("phq9depression").value),
      mdq_mania: parseInt(document.getElementById("mdq_mania").value),
      isi_insomnia: parseInt(document.getElementById("isi_insomnia").value),
      p16_prodromal_count: parseInt(document.getElementById("p16_prodromal_count").value),
      p16_prodromal_severity: parseInt(document.getElementById("p16_prodromal_severity").value),
      schizotypy_unusual_experiences: parseInt(document.getElementById("schizotypy_unusual_experiences").value),
      schizotypy_cognitive_disorganisation: parseInt(document.getElementById("schizotypy_cognitive_disorganisation").value),
      schizotypy_introvertive_anhedonia: parseInt(document.getElementById("schizotypy_introvertive_anhedonia").value),
      schizotypy_impulsive_nonconformity: parseInt(document.getElementById("schizotypy_impulsive_nonconformity").value),
      emotion_true: emotion_true
    };


    //Send request to Flask serve
    fetch("http://"+host+"/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(predictionData) 
    })
    .then(response => response.json()) 
    .then(result => {
      const predicted = emotions_h[parseInt(result.predicted_emotion)];
      const probabilities = result.probabilities;
    
      let probaHTML = "";
      if (typeof probabilities === "object") {
        probaHTML += "<div class='probabilities'><strong>Class Probabilities:</strong><ul>";
        for (const [emotion, prob] of Object.entries(probabilities)) {
          probaHTML += `<li>${emotions_h[emotion]}: ${(prob * 100).toFixed(2)}%</li>`;
        }
        probaHTML += "</ul></div>";
      }
    
      // SHAP PLOT 
      let shapPlotHTML = "";
      if (result.shap_plot) {
        shapPlotHTML = `
          <div class="shap-plot" style="margin-top: 20px;">
            <h4>Explanation</h4>
            <img src="data:image/png;base64,${result.shap_plot}" alt="SHAP Plot" style="max-width:100%; border: 1px solid #ccc; border-radius: 8px;" />
          </div>`;
      }
    
      const resultHTML = `
        <h3>Prediction Summary</h3>
        <p><strong>Age:</strong> ${age}</p>
        <p><strong>Sex:</strong> ${sex}</p>
        <p><strong>True Emotion:</strong> ${emotion_true}</p>
        <p><strong>Predicted Emotion:</strong> ${predicted}</p>
        ${probaHTML}
        ${shapPlotHTML} <!-- ✅ insertion du plot ici -->
      `;
    
      document.getElementById("resultContent").innerHTML = resultHTML;
      showSection("result");
    })
    
  });
});




const adminForm = document.getElementById("adminLoginForm");

if (adminForm) {
  adminForm.addEventListener("submit", (event) => {
    event.preventDefault(); // Prevent form from submitting and refreshing the page

    const usernameEl = document.getElementById("adminUsername");
    const passwordEl = document.getElementById("adminPassword");


    // Ensure the username is within allowed length
    if (usernameEl.value.length > MAX_USERNAME_LENGTH) {
      showWarning(usernameEl, `Max ${MAX_USERNAME_LENGTH} characters`);
      return;
    }

    // Ensure the password is within allowed length
    if (passwordEl.value.length > MAX_PASSWORD_LENGTH) {
      showWarning(passwordEl, `Max ${MAX_PASSWORD_LENGTH} characters`);
      return; 
    }

    //Login request backend
    fetch("http://"+host+"/admin_login", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({
        username: usernameEl.value.trim(),  
        password: passwordEl.value          
      })
    })
    .then(res => res.json()) 
    .then(data => {
      if (data.token) {
        // If login is successful, store token in browser session
        sessionStorage.setItem("adminToken", data.token);
        document.getElementById("adminLogin").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
      } else {
        document.getElementById("adminLoginError").style.display = "block";
      }
    })
    .catch(err => {
      console.error("Login error:", err);
      document.getElementById("adminLoginError").style.display = "block";
    });
  });
}

// When the "Logout" button is clicked we reset everything 
document.getElementById("logoutAdmin")?.addEventListener("click", () => {
  sessionStorage.removeItem("adminToken"); // Remove token from session
  document.getElementById("adminLogin").style.display = "block";
  document.getElementById("adminContent").style.display = "none";
  document.getElementById("adminUsername").value = "";
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminLoginError").style.display = "none";
});


const modelForm = document.getElementById("modelUploadForm");
if (modelForm) {
  modelForm.addEventListener("submit", (e) => {
    e.preventDefault(); 

    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      alert("Unauthorized. Please login as admin.");
      return; // Stop upload if user is not authenticated
    }

    // Validation of the file
    const fileInput = document.getElementById("newModel");
    const file = fileInput.files[0];

    // Ensure the file is selected and has valid extension
    if (!file || !file.name.endsWith(".sav")) {
      alert("Please upload a valid .sav file.");
      return; 
    }


    const formData = new FormData();
    formData.append("model", file); 

    fetch("http://"+host+"/upload_model", {
      method: "POST",
      headers: {
        // JWT token 
        "Authorization": `Bearer ${token}`
      },
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      document.getElementById("uploadStatus").innerText = data.message;
    })
    .catch(err => {
      document.getElementById("uploadStatus").innerText = "Upload failed.";
      console.error("❌ Upload error:", err);
    });
  });
};

function showWarning(inputElement, message) {
  inputElement.style.border = "2px solid red";
  const warning = document.createElement("div");
  warning.className = "field-warning";
  warning.style.color = "red";
  warning.style.fontSize = "12px";
  warning.innerText = message;
  inputElement.parentNode.appendChild(warning);
}
