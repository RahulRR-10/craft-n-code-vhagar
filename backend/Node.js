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
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 20, // Maximum 20 files per request
    },
});

// Enhanced CORS configuration
const corsOptions = {
    origin: ["http://192.168.1.9:3000", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // CORS preflight cache time - 24 hours
};

app.use(cors(corsOptions));
app.use(express.json());

// Azure Custom Vision credentials
const predictionKey = process.env.PREDICTION_KEY;
const endpoint = process.env.PREDICTION_ENDPOINT;
const projectId = process.env.PROJECT_ID;
const publishedName = process.env.PUBLISHED_NAME;

// Validate required environment variables
const requiredEnvVars = [
    "PREDICTION_KEY",
    "PREDICTION_ENDPOINT",
    "PROJECT_ID",
    "PUBLISHED_NAME",
];
const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
    console.error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`
    );
    process.exit(1);
}

const credentials = new ApiKeyCredentials({
    inHeader: { "Prediction-Key": predictionKey },
});

const predictor = new PredictionAPIClient(credentials, endpoint);

// Enhanced health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || "1.0.0",
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        status: "Server is running",
        endpoints: {
            health: "/health",
            analyze: "/api/analyze",
        },
    });
});

// Enhanced error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error",
        timestamp: new Date().toISOString(),
    });
};

// Endpoint to analyze single image
app.post("/api/analyze", upload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        const imageBuffer = req.file.buffer;
        const result = await predictor.classifyImage(
            projectId,
            publishedName,
            imageBuffer
        );

        // Process and format predictions
        const predictions = result.predictions.map((pred) => ({
            tagName: pred.tagName,
            probability: (pred.probability * 100).toFixed(2),
            boundingBox: pred.boundingBox, // Include if available
        }));

        res.json({
            predictions,
            metadata: {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        next(error); // Pass to error handler
    }
});

// Batch analysis endpoint
app.post(
    "/api/analyze-batch",
    upload.array("images", 20),
    async (req, res, next) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res
                    .status(400)
                    .json({ error: "No image files provided" });
            }

            const results = await Promise.all(
                req.files.map(async (file) => {
                    try {
                        const result = await predictor.classifyImage(
                            projectId,
                            publishedName,
                            file.buffer
                        );

                        return {
                            filename: file.originalname,
                            predictions: result.predictions.map((pred) => ({
                                tagName: pred.tagName,
                                probability: (pred.probability * 100).toFixed(
                                    2
                                ),
                                boundingBox: pred.boundingBox,
                            })),
                            metadata: {
                                mimetype: file.mimetype,
                                size: file.size,
                            },
                        };
                    } catch (error) {
                        return {
                            filename: file.originalname,
                            error: error.message,
                        };
                    }
                })
            );

            res.json({
                results,
                metadata: {
                    totalFiles: req.files.length,
                    successfulAnalyses: results.filter((r) => !r.error).length,
                    failedAnalyses: results.filter((r) => r.error).length,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// Rate limiting middleware
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Error handling middleware
app.use(errorHandler);

// Process handling
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Application specific logging, throwing an error, or other logic here
});

process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
    });
});

// Start the server
const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
