import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Button,
    Container,
    Typography,
    TextField,
    Card,
    LinearProgress,
    Alert,
    Box,
    List,
    ListItem,
    ListItemText,
} from "@mui/material";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const BACKEND_URL = "http://192.168.1.9:5000";
const BATCH_SIZE = 5; // Number of files to upload in each request

function App() {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [serverStatus, setServerStatus] = useState("checking");
    const [freshCount, setFreshCount] = useState(0);
    const [rottenCount, setRottenCount] = useState(0);
    const [batchInfo, setBatchInfo] = useState({
        product_name: "",
        brand: "",
        nutritional_info: "",
        expiration_date: "",
        regulatory_notes: "",
    });
    const [batchDocuments, setBatchDocuments] = useState([]);

    useEffect(() => {
        checkServerStatus();
    }, []);

    const checkServerStatus = async () => {
        try {
            await axios.get(BACKEND_URL + "/health");
            setServerStatus("connected");
        } catch (error) {
            setServerStatus("disconnected");
            setError(
                "Cannot connect to server. Please ensure the backend is running."
            );
        }
    };

    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setSelectedFiles(files);
            setPredictions([]);
            setError(null);
            setFreshCount(0);
            setRottenCount(0);
        }
    };

    const handleBatchFileSelect = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setBatchFiles(files);
        }
    };

    const processPredictions = (predictions) => {
        const pairs = {
            quality: predictions.filter((p) =>
                ["rotten", "fresh"].includes(p.tagName.toLowerCase())
            ),
        };

        const highestQuality = pairs.quality.reduce((prev, current) =>
            parseFloat(prev.probability) > parseFloat(current.probability)
                ? prev
                : current
        );

        return highestQuality
            ? {
                  category: "Quality",
                  tagName: highestQuality.tagName,
                  probability: highestQuality.probability,
              }
            : null;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (selectedFiles.length === 0) {
            setError("Please select images first");
            return;
        }

        setLoading(true);
        setError(null);

        let freshImageCount = 0;
        let rottenImageCount = 0;
        const allPredictions = [];

        try {
            // Process files in batches
            for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
                const batch = selectedFiles.slice(i, i + BATCH_SIZE);
                const predictionsArr = await Promise.all(
                    batch.map(async (file) => {
                        const formData = new FormData();
                        formData.append("image", file);

                        const response = await axios.post(
                            `${BACKEND_URL}/api/analyze`,
                            formData,
                            {
                                headers: {
                                    "Content-Type": "multipart/form-data",
                                },
                                timeout: 30000,
                            }
                        );

                        const filteredPrediction = processPredictions(
                            response.data.predictions
                        );

                        if (filteredPrediction && filteredPrediction.tagName) {
                            if (
                                filteredPrediction.tagName.toLowerCase() ===
                                "fresh"
                            ) {
                                freshImageCount++; // Count how many are "fresh"
                            } else if (
                                filteredPrediction.tagName.toLowerCase() ===
                                "rotten"
                            ) {
                                rottenImageCount++; // Count how many are "rotten"
                            }
                        }

                        return filteredPrediction;
                    })
                );

                allPredictions.push(...predictionsArr.filter(Boolean));
            }

            setPredictions(allPredictions);
            setFreshCount(freshImageCount); // Set the count of fresh images
            setRottenCount(rottenImageCount); // Set the count of rotten images
        } catch (error) {
            console.error("Error uploading images:", error);
            let errorMessage = "Error analyzing images. ";

            if (error.response) {
                errorMessage +=
                    error.response.data.error || error.response.statusText;
            } else if (error.code === "ECONNABORTED") {
                errorMessage += "Request timed out. Please try again.";
            } else {
                errorMessage += "Please check your connection and try again.";
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchSubmit = (event) => {
        event.preventDefault();
        if (Object.values(batchInfo).some((value) => value.trim() === "")) {
            setError("Please fill out all fields");
            return;
        }

        // Add batch document info to the state
        setBatchDocuments((prev) => [...prev, { ...batchInfo }]);

        // Reset batch info and files after submission
        setBatchInfo({
            product_name: "",
            brand: "",
            nutritional_info: "",
            expiration_date: "",
            regulatory_notes: "",
        });
        setBatchFiles([]);
        setError(null);
    };

    const handleSaveJSON = () => {
        const jsonData = { products: batchDocuments };
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "batch_documents.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    // Data for Pie Chart
    const pieData = [
        { name: "Fresh", value: freshCount },
        { name: "Rotten", value: rottenCount },
    ];

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
                Food Quality Analyzer
            </Typography>

            {serverStatus === "disconnected" && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Server connection failed. Please ensure the backend server
                    is running on {BACKEND_URL}.
                </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <Card variant="outlined" sx={{ p: 3, mb: 2 }}>
                    <TextField
                        type="file"
                        fullWidth
                        onChange={handleFileSelect}
                        inputProps={{ accept: "image/*", multiple: true }}
                    />
                </Card>

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    type="submit"
                    disabled={
                        selectedFiles.length === 0 ||
                        loading ||
                        serverStatus === "disconnected"
                    }
                >
                    {loading ? "Analyzing..." : "Analyze Images"}
                </Button>

                {loading && <LinearProgress sx={{ mt: 2 }} />}
            </form>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}

            {predictions.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                    <Typography variant="h6" gutterBottom>
                        Results:
                    </Typography>
                    <PieChart width={300} height={300}>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? "#4caf50" : "#f44336"}
                                />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                    <Typography variant="h6" color="primary">
                        Fresh Fruits: {freshCount} / {selectedFiles.length}
                    </Typography>
                    <Typography variant="h6" color="primary">
                        Percentage of Fresh Fruits:{" "}
                        {((freshCount / selectedFiles.length) * 100).toFixed(2)}
                        %
                    </Typography>
                </div>
            )}

            {/* Batch Document Form */}
            <form
                onSubmit={handleBatchSubmit}
                noValidate
                style={{ marginTop: "24px" }}
            >
                <Card variant="outlined" sx={{ p: 3, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Batch Document Information
                    </Typography>
                    <TextField
                        label="Product Name"
                        fullWidth
                        value={batchInfo.product_name}
                        onChange={(e) =>
                            setBatchInfo({
                                ...batchInfo,
                                product_name: e.target.value,
                            })
                        }
                        required
                    />
                    <TextField
                        label="Brand"
                        fullWidth
                        value={batchInfo.brand}
                        onChange={(e) =>
                            setBatchInfo({
                                ...batchInfo,
                                brand: e.target.value,
                            })
                        }
                        required
                    />
                    <TextField
                        label="Nutritional Value"
                        fullWidth
                        value={batchInfo.nutritional_info}
                        onChange={(e) =>
                            setBatchInfo({
                                ...batchInfo,
                                nutritional_info: e.target.value,
                            })
                        }
                        required
                    />
                    <TextField
                        label="Expiry Date"
                        type="date"
                        fullWidth
                        value={batchInfo.expiration_date}
                        onChange={(e) =>
                            setBatchInfo({
                                ...batchInfo,
                                expiration_date: e.target.value,
                            })
                        }
                        required
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                    <TextField
                        label="Regulatory Notes"
                        fullWidth
                        value={batchInfo.regulatory_notes}
                        onChange={(e) =>
                            setBatchInfo({
                                ...batchInfo,
                                regulatory_notes: e.target.value,
                            })
                        }
                        required
                    />
                </Card>
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    type="submit"
                >
                    Submit Batch Document
                </Button>
            </form>

            {/* Displaying batch document titles */}
            {batchDocuments.length > 0 && (
                <Box sx={{ marginTop: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Uploaded Batch Document Titles:
                    </Typography>
                    <List>
                        {batchDocuments.map((doc, index) => (
                            <ListItem key={index}>
                                <ListItemText
                                    primary={doc.product_name}
                                    secondary={`Brand: ${doc.brand}, Expiry: ${doc.expiration_date}`}
                                />
                            </ListItem>
                        ))}
                    </List>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleSaveJSON}
                        sx={{ mt: 2 }}
                    >
                        Download Batch Documents as JSON
                    </Button>
                </Box>
            )}
        </Container>
    );
}

export default App;
