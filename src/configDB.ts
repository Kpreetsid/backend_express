export const database = {
    host: '52.66.196.15',
    port: 27017,
    userName: 'newUser',
    password: 'newPassword',
    databaseName: 'test',
};
export const server = {
    host: 'localhost',
    port: 3000,
    protocol: 'http',
}
export const auth = {
    secret: 'your_secret_key',
    expiresIn: '1d',
    algorithm: 'HS256',
    issuer: 'your_issuer',
    audience: 'your_audience',
    refreshTokenExpiresIn: '30d',
    refreshTokenAlgorithm: 'HS256',
    refreshTokenIssuer: 'your_refresh_token_issuer',
    refreshTokenAudience: 'your_refresh_token_audience',
    refreshTokenSecret: 'your_refresh_token_secret'
}