import express from 'express';
import { getComments, getComment, createComment, updateComment, removeComment } from './comment.controller';

export default (router: express.Router) => {
    router.get('/comments', getComments);
    router.get('/comment/:id', getComment);
    router.post('/comment', createComment);
    router.put('/comment/:id', updateComment);
    router.delete('/comment/:id', removeComment);
}