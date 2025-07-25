#Backend part

from flask import Flask, request, jsonify, render_template
import joblib
import pandas as pd
import os
from flask_cors import CORS
import jwt
import datetime
import io
import base64
import shap
import pickle
import matplotlib
matplotlib.use("Agg")  
import matplotlib.pyplot as plt


def create_app():

    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)



    #Here we set up the token used for the security verification, username and password
    SECRET_KEY = "18c66466c8f38462cb78d4224172b294e79872a81eb978bf46bed7594d30fb1f"
    ADMIN_USERNAME = "AdministratorUPC"
    ADMIN_PASSWORD = "eVk8JYN!"


    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploaded_models')

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)


    #Upload folder and default template
    #UPLOAD_FOLDER = "uploaded_models"
    #os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    #MODEL_PATH = os.path.join("GAM", "models", "dataset_emotional_faces_emotion_predicted_NeuralNetwork_model_.txt_.sav")
    MODEL_PATH = os.path.join(UPLOAD_FOLDER, "dataset_emotional_faces_emotion_predicted_RandomForest_model_.txt_.sav")
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)

    EXPLAINER_PATH = os.path.join(UPLOAD_FOLDER, "dataset_emotional_faces_emotion_predicted_RandomForest_explainer_.sav")
    with open(EXPLAINER_PATH, "rb") as f:
        explainer = pickle.load(f)


    @app.route("/")
    def home():
        return render_template("index.html")

    #LOGIN
    @app.route("/admin_login", methods=["POST"]) #Defines an HTTP POST route at /admin_login that will be used for admin authentication.
    def admin_login():
        data = request.json
        username = data.get("username")
        password = data.get("password")

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            token = jwt.encode(
                {
                    "user": username,
                    "exp": datetime.datetime.now() + datetime.timedelta(hours=2)
                },
                SECRET_KEY,
                algorithm="HS256"
            )

            return jsonify({"token": token})
        else:
            return jsonify({"error": "Invalid credentials"}), 401




    #UPLOAD MODEL
    @app.route("/upload_model", methods=["POST"])
    def upload_model():
        global model

        #Extract the Authorization header from the request
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"message": "Missing or invalid token"}), 403


        #Extract the JWT token from the Authorization header
        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if decoded.get("user") != ADMIN_USERNAME:
                return jsonify({"message": "Unauthorized user"}), 403

        except Exception as e:
            return jsonify({"message": f"Token error: {str(e)}"}), 403

        try:
            #Check that a file was included in the request under the ".sav" field
            if "model" not in request.files:
                return jsonify({"message": "No file part"}), 400

            file = request.files["model"]
            if file.filename == "":
                return jsonify({"message": "No selected file"}), 400
            if not file.filename.endswith(".sav"):
                return jsonify({"message": "Only .sav files allowed"}), 400

            new_model_path = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(new_model_path)

            #Load the new model using joblib and replace the active model
            model = joblib.load(new_model_path)
            return jsonify({"message": "✅ New model loaded successfully."})
        except Exception as e:
            return jsonify({"message": f"❌ Error: {str(e)}"}), 500



    @app.route("/predict", methods=["POST"])
    def predict():
        data = request.json
        print("✅ Received Datas :", data)

        try:
            #Convert user datas in dataframe
            df_raw = pd.DataFrame([data])

            #Encoding text categories into integers
            sex_map = {"male": 0, "female": 1}
            emotion_map = {
                "anger": 0,
                "disgust": 1,
                "fear": 2,
                "happiness": 3,
                "neutral": 4,
                "sadness": 5,
                "surprise": 6
            }

            df_raw["sex"] = df_raw["sex"].str.lower().map(sex_map)
            df_raw["emotion_true"] = df_raw["emotion_true"].str.lower().map(emotion_map)

            #Checking for valid values
            if df_raw["sex"].isnull().any() or df_raw["emotion_true"].isnull().any():
                raise ValueError("Invalid category value for 'sex' or 'emotion_true'.")

            #Explicit cast of types
            df_raw = df_raw.astype({
                "age": int,
                "sex": int,
                "gad7_anxiety": int,
                "phq9depression": int,
                "mdq_mania": int,
                "isi_insomnia": int,
                "p16_prodromal_count": int,
                "p16_prodromal_severity": int,
                "schizotypy_unusual_experiences": int,
                "schizotypy_cognitive_disorganisation": int,
                "schizotypy_introvertive_anhedonia": int,
                "schizotypy_impulsive_nonconformity": int,
                "emotion_true": int
            })

            #Prediction
            prediction = model.predict(df_raw)
            pred_class = int(prediction[0])

            #Probabilities
            proba = model.predict_proba(df_raw) if hasattr(model, "predict_proba") else None

            #SHAP explainer
            shap_values = explainer(df_raw)

            if len(shap_values.values.shape) == 3:
                values = shap_values.values[0, pred_class]
                base_values = shap_values.base_values[0, pred_class]
            else:
                values = shap_values.values[0]
                base_values = shap_values.base_values[0]

            explanation = shap.Explanation(
                values=values,
                base_values=base_values,
                data=shap_values.data[0],
                feature_names=shap_values.feature_names
            )

            #SHAP plot
            fig = plt.figure()
            shap.plots.waterfall(explanation, max_display=20, show=False)
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches='tight')
            plt.close(fig)
            buf.seek(0)
            shap_plot_base64 = base64.b64encode(buf.read()).decode("utf-8")

            return jsonify({
                "predicted_emotion": str(pred_class),
                "probabilities": {
                    str(cls): float(p) for cls, p in zip(model.classes_, proba[0])
                } if proba is not None else "Not available",
                "shap_plot": shap_plot_base64
            })

        except Exception as e:
            print("❌ Error :", str(e))
            return jsonify({"error": str(e)}), 400
    #app.run()
    return app

#MAIN APP RUN
if __name__ == "__main__":
    create_app().run(debug=True)
