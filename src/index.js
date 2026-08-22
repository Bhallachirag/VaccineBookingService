const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const { PORT, VACCINE_FRONTEND_PATH } = require('./config/serverConfig');

app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));

const apiRoutes = require('./routes/index');
const db = require('./models/index');

const setupAndStartServer = () => {

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));   

    app.use('/api', apiRoutes);

    app.listen(PORT, () => {
        console.log(`Server started on PORT ${PORT}`);
        if(process.env.DB_SYNC) {
            db.sequelize.sync({ alter: true }); 
        }
    });
}

setupAndStartServer();