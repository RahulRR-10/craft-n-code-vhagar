import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    TextField,
    Alert,
    LinearProgress,
    Container,
    Grid,
    Paper,
    IconButton,
    Input,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const BACKEND_URL = "http://192.168.1.9:5000";
const BATCH_SIZE = 5;

// Styled components
const VisuallyHiddenInput = styled("input")({
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    bottom: 0,
    left: 0,
    whiteSpace: "nowrap",
    width: 1,
});

const UploadBox = styled(Paper)(({ theme }) => ({
    border: `2px dashed ${theme.palette.grey[300]}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.3s ease-in-out",
    "&:hover": {
        borderColor: theme.palette.primary.main,
    },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
}));

const ProductAnalyzer = () => {
    // State management
    const [serverStatus, setServerStatus] = useState("checking");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [freshCount, setFreshCount] = useState(0);
    const [rottenCount, setRottenCount] = useState(0);
    const [predictions, setPredictions] = useState([]);
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
            await axios.get(`${BACKEND_URL}/health`);
            setServerStatus("connected");
        } catch (error) {
            setServerStatus("disconnected");
            setError(
                "Cannot connect to server. Please ensure the backend is running."
            );
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

    const handleFileSelect = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(files);
            setPredictions([]);
            setError(null);
            setFreshCount(0);
            setRottenCount(0);
        }
    };

    const handleAnalyze = async (event) => {
        event.preventDefault();
        if (selectedFiles.length === 0) {
            setError("Please select images first");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let freshImageCount = 0;
            let rottenImageCount = 0;
            const allPredictions = [];

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

                        if (filteredPrediction?.tagName) {
                            if (
                                filteredPrediction.tagName.toLowerCase() ===
                                "fresh"
                            ) {
                                freshImageCount++;
                            } else if (
                                filteredPrediction.tagName.toLowerCase() ===
                                "rotten"
                            ) {
                                rottenImageCount++;
                            }
                        }

                        return filteredPrediction;
                    })
                );

                allPredictions.push(...predictionsArr.filter(Boolean));
            }

            setPredictions(allPredictions);
            setFreshCount(freshImageCount);
            setRottenCount(rottenImageCount);
        } catch (error) {
            console.error("Error uploading images:", error);
            const errorMessage =
                error.response?.data?.error || error.code === "ECONNABORTED"
                    ? "Request timed out. Please try again."
                    : "Please check your connection and try again.";
            setError(`Error analyzing images. ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setBatchInfo((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (Object.values(batchInfo).some((value) => value.trim() === "")) {
            setError("Please fill out all fields");
            return;
        }

        const enrichedBatchInfo = {
            ...batchInfo,
            quality_analysis: {
                fresh_count: freshCount,
                rotten_count: rottenCount,
                total_analyzed: selectedFiles.length,
                fresh_percentage: (
                    (freshCount / selectedFiles.length) *
                    100
                ).toFixed(2),
            },
        };

        setBatchDocuments((prev) => [...prev, enrichedBatchInfo]);
        setBatchInfo({
            product_name: "",
            brand: "",
            nutritional_info: "",
            expiration_date: "",
            regulatory_notes: "",
        });
        setError(null);
    };

    const handleSaveJSON = () => {
        const jsonData = { products: batchDocuments };
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "products.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const chartData = predictions.map((pred, index) => ({
        name: `Sample ${index + 1}`,
        probability: parseFloat(pred.probability) * 100,
    }));

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Grid container spacing={4}>
                {/* Image Analysis Section */}
                <Grid item xs={12} md={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom>
                                Product Quality Analysis
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                gutterBottom
                            >
                                Upload images for AI analysis
                            </Typography>

                            {serverStatus === "disconnected" && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    Server connection failed. Please ensure the
                                    backend server is running.
                                </Alert>
                            )}

                            {error && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {error}
                                </Alert>
                            )}

                            <Box sx={{ mt: 2, mb: 3 }}>
                                <UploadBox>
                                    <Button
                                        component="label"
                                        variant="text"
                                        startIcon={<CloudUploadIcon />}
                                    >
                                        Upload Images
                                        <VisuallyHiddenInput
                                            type="file"
                                            multiple
                                            onChange={handleFileSelect}
                                            accept="image/*"
                                        />
                                    </Button>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {selectedFiles.length > 0
                                            ? `${selectedFiles.length} files selected`
                                            : "Click to select images"}
                                    </Typography>
                                </UploadBox>
                            </Box>

                            <Button
                                variant="contained"
                                fullWidth
                                onClick={handleAnalyze}
                                disabled={
                                    selectedFiles.length === 0 ||
                                    loading ||
                                    serverStatus === "disconnected"
                                }
                            >
                                {loading ? "Analyzing..." : "Analyze Images"}
                            </Button>

                            {loading && <LinearProgress sx={{ mt: 2 }} />}

                            {predictions.length > 0 && (
                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Analysis Results
                                    </Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <Typography>
                                            Fresh Items: {freshCount} /{" "}
                                            {selectedFiles.length}
                                        </Typography>
                                        <Typography>
                                            Fresh Percentage:{" "}
                                            {(
                                                (freshCount /
                                                    selectedFiles.length) *
                                                100
                                            ).toFixed(2)}
                                            %
                                        </Typography>
                                    </Box>

                                    <Box sx={{ height: 300, width: "100%" }}>
                                        <ResponsiveContainer>
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Line
                                                    type="monotone"
                                                    dataKey="probability"
                                                    stroke="#1976d2"
                                                    strokeWidth={2}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Product Details Form */}
                <Grid item xs={12} md={6}>
                    <Card elevation={3}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom>
                                Product Details
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                gutterBottom
                            >
                                Enter product information
                            </Typography>

                            <Box
                                component="form"
                                onSubmit={handleSubmit}
                                sx={{ mt: 2 }}
                            >
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Product Name"
                                            name="product_name"
                                            value={batchInfo.product_name}
                                            onChange={handleInputChange}
                                            required
                                            variant="outlined"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Brand"
                                            name="brand"
                                            value={batchInfo.brand}
                                            onChange={handleInputChange}
                                            required
                                            variant="outlined"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Nutritional Info"
                                            name="nutritional_info"
                                            value={batchInfo.nutritional_info}
                                            onChange={handleInputChange}
                                            required
                                            variant="outlined"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            type="date"
                                            label="Expiration Date"
                                            name="expiration_date"
                                            value={batchInfo.expiration_date}
                                            onChange={handleInputChange}
                                            required
                                            variant="outlined"
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            label="Regulatory Notes"
                                            name="regulatory_notes"
                                            value={batchInfo.regulatory_notes}
                                            onChange={handleInputChange}
                                            variant="outlined"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            fullWidth
                                            size="large"
                                        >
                                            Save Product
                                        </Button>
                                    </Grid>
                                    {batchDocuments.length > 0 && (
                                        <Grid item xs={12}>
                                            <Button
                                                variant="outlined"
                                                fullWidth
                                                onClick={handleSaveJSON}
                                                size="large"
                                            >
                                                Download JSON
                                            </Button>
                                        </Grid>
                                    )}
                                </Grid>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
};

export default ProductAnalyzer;
