require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const {
    PredictionAPIClient,
} = require("@azure/cognitiveservices-customvision-prediction");
const { ApiKeyCredentials } = require("@azure/ms-rest-js");

const app = express();
const port = process.env.PORT || 5000;

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configure CORS to accept requests from your React app
const corsOptions = {
    origin: ["http://192.168.1.9:3000"], // Replace with your React app's origin
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Azure Custom Vision credentials
const predictionKey = process.env.PREDICTION_KEY;
const endpoint = process.env.PREDICTION_ENDPOINT;
const projectId = process.env.PROJECT_ID;
const publishedName = process.env.PUBLISHED_NAME;

const credentials = new ApiKeyCredentials({
    inHeader: { "Prediction-Key": predictionKey },
});
const predictor = new PredictionAPIClient(credentials, endpoint);

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "Server is running" });
});

app.get("/", (req, res) => {
    res.json({ status: "Server is running" });
});

// Endpoint to analyze multiple images
app.post("/api/analyze", upload.array("images", 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No image files provided" });
        }

        const predictions = [];
        for (const file of req.files) {
            const imageBuffer = file.buffer;
            const result = await predictor.classifyImage(
                projectId,
                publishedName,
                imageBuffer
            );

            // Collect predictions for each image
            const imagePredictions = result.predictions.map((pred) => ({
                tagName: pred.tagName,
                probability: (pred.probability * 100).toFixed(2),
            }));

            predictions.push(...imagePredictions); // Append predictions
        }

        res.json({ predictions });
    } catch (error) {
        console.error("Error analyzing images:", error);
        res.status(500).json({
            error: "Error processing images",
            details: error.message,
        });
    }
});

// Start the server
app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});
