import express from 'express';
const router = express.Router();
import { settingsController } from '@modules/settings/controllers/settings.controller';

export default (): express.Router => {
    router.get('/', settingsController.getAllSettings);
    return router;
}
