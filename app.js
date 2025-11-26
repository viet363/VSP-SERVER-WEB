import express from "express";
import cors from "cors";
import categoriesRoute from "./routes/categories.js";
import productsRoute from "./routes/products.js";
import customersRoute from "./routes/customers.js";
import ordersRoute from "./routes/orders.js";
import dashboardRoute from "./routes/dashboard.js";
import inventoryRoute from "./routes/inventory.js";
import warehousesRoute from "./routes/warehouses.js";
import authRouter from "./routes/auth.js";


const app = express();

const frontendUrl = "http://localhost:3000";

const corsOptions = {
    origin: frontendUrl, 
    
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", 
    
    credentials: true,
    
    optionsSuccessStatus: 204 
};

app.use(cors(corsOptions)); 
app.use(express.json());

app.use("/api/categories", categoriesRoute);
app.use("/api/products", productsRoute);
app.use("/api/customers", customersRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/inventory", inventoryRoute);
app.use("/api/warehouses", warehousesRoute);
app.use("/api", authRouter);


app.get("/", (req, res) => res.send("VPS backend is running"));

export default app;