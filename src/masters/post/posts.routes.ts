import express from 'express';
import { getPosts, getPost, createPost, updatePost, removePost } from './posts.controller';

export default (router: express.Router) => {
    router.get('/posts', getPosts);
    router.get('/post/:id', getPost);
    router.post('/post', createPost);
    router.put('/post/:id', updatePost);
    router.delete('/post/:id', removePost);
}