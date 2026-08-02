const dotenv = require("dotenv")
const express = require("express")
const swaggerUi = require("swagger-ui-express")
const swaggerDocument = require("./swagger.json")

const authRoute = require("./routes/v1/auth_route")
const db = require("./config/db")
const postRoute = require("./routes/v1/post_route")
const userRoute = require("./routes/v1/user_route")

const app = express()
dotenv.config()

const PORT = process.env.PORT
app.use(express.json())
app.use("/api/v1/auth", authRoute)
app.use("/api/v1/post", postRoute)
app.use("/api/v1/user", userRoute)
app.use("/api-docs",swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
        customSiteTitle: "App API Docs",
        swaggerOptions: {
            persistAuthorization: true,displayRequestDuration: true,docExpansion: "none",tryItOutEnabled: true         
        }
    })
)

app.get("/test", (req, res) => {
    res.status(200).send("Test")
})

const dbConnection = async () => {
    try {
        const result = await db.query("SELECT 1")
        if (result && result[0]) {
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`)
            })
        }
    } catch (err) {
        console.log("DB connection failed:", err)
        process.exit(1)
    }
}
 
dbConnection()
