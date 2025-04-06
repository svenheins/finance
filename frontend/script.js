document.addEventListener('DOMContentLoaded', () => {
    const symbolInput = document.getElementById('symbol');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const fetchButton = document.getElementById('fetch-button');
    const updateButton = document.getElementById('update-button');
    const chartCanvas = document.getElementById('stockChart');
    const messageArea = document.getElementById('message-area');

    let stockChart = null; // Variable to hold the chart instance

    // --- Chart Initialization ---
    function initializeChart() {
        const ctx = chartCanvas.getContext('2d');
        stockChart = new Chart(ctx, {
            type: 'line', // Use line chart for time series
            data: {
                datasets: [] // Start with empty datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day', // Adjust time unit based on data granularity
                            tooltipFormat: 'PPpp', // Date-fns format for tooltips
                            displayFormats: {
                                day: 'MMM d, yyyy' // Date-fns format for axis labels
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price (USD)' // Assuming USD, adjust if needed
                        },
                        beginAtZero: false // Don't force y-axis to start at 0
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Stock Price Data'
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // --- Display Messages ---
    function showMessage(message, type = 'info') {
        messageArea.textContent = message;
        messageArea.className = type; // 'success', 'error', or remove class for info
        // Clear message after some time
        setTimeout(() => {
            messageArea.textContent = '';
            messageArea.className = '';
        }, 5000);
    }

    // --- Render Chart Data ---
    function renderChart(data, symbol) {
        if (!stockChart) {
            initializeChart();
        }

        // Prepare data for Chart.js
        const labels = data.map(item => new Date(item.timestamp)); // Use Date objects for time scale
        const closePrices = data.map(item => ({ x: new Date(item.timestamp), y: item.close }));
        // You can add more datasets (open, high, low) if desired
        // const openPrices = data.map(item => ({ x: new Date(item.timestamp), y: item.open }));
        // const highPrices = data.map(item => ({ x: new Date(item.timestamp), y: item.high }));
        // const lowPrices = data.map(item => ({ x: new Date(item.timestamp), y: item.low }));

        stockChart.data.datasets = [
            {
                label: `${symbol} Close Price`,
                data: closePrices,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }
            // Add more datasets here if needed
            // { label: `${symbol} Open Price`, data: openPrices, borderColor: '...', tension: 0.1 },
            // { label: `${symbol} High Price`, data: highPrices, borderColor: '...', tension: 0.1 },
            // { label: `${symbol} Low Price`, data: lowPrices, borderColor: '...', tension: 0.1 },
        ];

        stockChart.options.plugins.title.text = `Stock Price Data for ${symbol.toUpperCase()}`;
        stockChart.update(); // Update the chart with new data
    }

    // --- Fetch Stock Data ---
    async function fetchStockData() {
        const symbol = symbolInput.value.trim().toUpperCase();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!symbol) {
            showMessage('Please enter a stock symbol.', 'error');
            return;
        }

        // Construct API URL
        // Assuming the backend runs on localhost:8000
        let apiUrl = `http://localhost:8000/stocks/${symbol}`;
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const queryString = params.toString();
        if (queryString) {
            apiUrl += `?${queryString}`;
        }

        showMessage('Fetching data...', 'info');

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error fetching data.' }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.length > 0) {
                renderChart(data, symbol);
                showMessage(`Successfully fetched data for ${symbol}.`, 'success');
            } else {
                 if (stockChart) {
                    stockChart.data.datasets = []; // Clear chart if no data
                    stockChart.update();
                 }
                showMessage(`No data found for ${symbol} in the specified range.`, 'info');
            }

        } catch (error) {
            console.error('Fetch error:', error);
            showMessage(`Error fetching data: ${error.message}`, 'error');
             if (stockChart) {
                stockChart.data.datasets = []; // Clear chart on error
                stockChart.update();
             }
        }
    }

    // --- Update Symbol Data (Trigger Backend Fetch) ---
    async function updateSymbolData() {
        const symbol = symbolInput.value.trim().toUpperCase();
        if (!symbol) {
            showMessage('Please enter a stock symbol to update.', 'error');
            return;
        }

        const apiUrl = `http://localhost:8000/stocks/${symbol}`;
        showMessage(`Requesting update for ${symbol}...`, 'info');

        try {
            const response = await fetch(apiUrl, { method: 'POST' });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ detail: 'Unknown error updating data.' }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            showMessage(result.message || `Update request for ${symbol} sent successfully. Fetch data again to see updates.`, 'success');

        } catch (error) {
            console.error('Update error:', error);
            showMessage(`Error updating data: ${error.message}`, 'error');
        }
    }


    // --- Event Listeners ---
    fetchButton.addEventListener('click', fetchStockData);
    updateButton.addEventListener('click', updateSymbolData);

    // --- Initial Setup ---
    initializeChart(); // Initialize chart structure on load
    // Optional: Fetch default data on load
    // fetchStockData();
});