import express from 'express';
import { getAllTeams, getTeamsByID, createTeams, updateTeams, removeTeams } from './team.controller';
import { hasPermission } from '../../middlewares';

export default (router: express.Router) => {
    const teamsRouter = express.Router();
    teamsRouter.get('/', getAllTeams);
    teamsRouter.get('/:id', getTeamsByID);
    teamsRouter.post('/', createTeams);
    teamsRouter.put('/:id', updateTeams);
    teamsRouter.delete('/:id', hasPermission('admin'),removeTeams);
    router.use('/teams', teamsRouter);
}