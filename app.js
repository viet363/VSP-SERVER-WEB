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
import mobileAuthRoute from "./routes/mobile/authMobile.js";
import mobileProductsRoute from "./routes/mobile/productsMobile.js";
import mobileCategoriesRoute from "./routes/mobile/categoriesMobile.js";
import mobileCartRoute from "./routes/mobile/cartMobile.js";
import mobileOrdersRoute from "./routes/mobile/ordersMobile.js";
import mobileWishlistRoute from "./routes/mobile/wishlistMobile.js";
import mobileAddressRoute from "./routes/mobile/addressMobile.js";
import mobileNotificationRoute from "./routes/mobile/notificationMobile.js";
import mobilePaymentRoute from "./routes/mobile/paymentMobile.js";
import mobileUserRoute from "./routes/mobile/userMobile.js";
import mobileRecommendRoute from "./routes/mobile/recommendMobile.js";

const app = express();

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            "http://localhost:3000", 
            "http://192.168.1.100:8081",
            "http://192.168.1.100:4000",
            "http://192.168.3.84:4000", 
            "http://192.168.3.84",
            "http://localhost:8081",
            "http://10.0.2.2:4000" 
        ];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
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
app.use("/api/mobile/auth", mobileAuthRoute);
app.use("/api/mobile/products", mobileProductsRoute);
app.use("/api/mobile/categories", mobileCategoriesRoute);
app.use("/api/mobile/cart", mobileCartRoute);
app.use("/api/mobile/orders", mobileOrdersRoute);
app.use("/api/mobile/wishlist", mobileWishlistRoute);
app.use("/api/mobile/address", mobileAddressRoute);
app.use("/api/mobile/notification", mobileNotificationRoute);
app.use("/api/mobile/payment", mobilePaymentRoute);
app.use("/api/mobile/user", mobileUserRoute);
app.use("/api/mobile/recommend", mobileRecommendRoute);


app.get("/", (req, res) => res.send("VPS backend is running"));

export default app;