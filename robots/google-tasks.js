const moment = require('moment');
const path = require('path');
const express = require('express');
const google = require('googleapis').google
const OAuth2 = google.auth.OAuth2;

const fs = require('fs');
const TOKEN_PATH = path.resolve(__dirname, '..', 'credentials',  'task-user.json');

async function robot (tasks) {
    const auth = await authenticateWithOAuth();
    const service = google.tasks({version: 'v1', auth});

    console.log(`> [tasks-robot] Get "SENAC" task list`);
    const tasklist = await getTaskListSenac(service);
    
    const listSaved = await service.tasks.list({
      tasklist: tasklist.id,
      showDeleted: true
    });
    
    console.log(`> [tasks-robot] Saving tasks...`);
    for (const task of tasks) {
      let index = 0;
      console.log(`> [tasks-robot] ${task.name}`);

      for (const innerTask of task.innerTasks) {  
        console.log(`> [tasks-robot] [${index+1}/${task.innerTasks.length}] Saving ${innerTask.title}`);
        const notes = innerTask.notes ? ` ${innerTask.notes}` : '';
        await insertIfNotExists({
          tasklist: tasklist.id,
          requestBody : {
              title: innerTask.title,
              notes: `Matéria - ${task.name}${notes}`,
              due: innerTask.due
          }
        }, listSaved);
        index++;
      }
    }
    console.log(`> [tasks-robot] Complete`);

    async function insertIfNotExists(data, list) {
      let saved, id;

      if (list.data && list.data.items) {
        saved = list.data.items.find(m => m.title === data.requestBody.title);
      }

      if (!saved) {
        const result = await service.tasks.insert(data);
        id = result.data.id;
      } else {
        id = saved.id;
      }

      return id;
    }

    async function getTaskListSenac() {
        const listResult = await service.tasklists.list();

        const list = listResult.data.items.find(m => m.title === "SENAC");

        if (!list) throw new Error("Lista 'SENAC' não encontrada");

        return list;
    }

    async function authenticateWithOAuth() {
      let token;
      let refreshToken = true;
      const OAuthClient = await createOAuthClient();

      if (fs.existsSync(TOKEN_PATH)){
        token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        refreshToken = false;
        
        if (!moment(token.expiry_date).isAfter(new Date())) {
          console.log(`> [tasks-robot] Refresh google token`);
          refreshToken = true;
        }
      }

      if (refreshToken) {
        console.log(`> [tasks-robot] New google token`);
        const webServer = await startWebServer();
        requestUserConsent(OAuthClient);
        const authorizationToken = await waitForGoogleCallback(webServer);
        token = await requestGoogleForAccessTokens(OAuthClient, authorizationToken);
        await stopWebServer(webServer);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token), 'utf8');
      }

      setGlobalGoogleAuthentication(token);

      return OAuthClient;

      async function startWebServer() {
          return new Promise((resolve, reject) => {
            const port = 5000
            const app = express()
    
            const server = app.listen(port, () => {
              console.log(`> [tasks-robot] Listening on http://localhost:${port}`)
    
              resolve({
                app,
                server
              })
            });
          });
      }

      async function createOAuthClient() {
          const credentials = require('../credentials/google-tasks.json');
    
          const OAuthClient = new OAuth2(
            credentials.web.client_id,
            credentials.web.client_secret,
            credentials.web.redirect_uris[0]
          );
    
          return OAuthClient
      }

      function requestUserConsent(OAuthClient) {
          const consentUrl = OAuthClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/tasks']
          })
    
          console.log(`> [tasks-robot] Please give your consent: ${consentUrl}`)
      }

      async function waitForGoogleCallback(webServer) {
          return new Promise((resolve, reject) => {
            console.log('> [tasks-robot] Waiting for user consent...')
    
            webServer.app.get('/oauth2callback', (req, res) => {
              const authCode = req.query.code
              console.log(`> [tasks-robot] Consent given: ${authCode}`)
    
              res.send('<h1>Thank you!</h1><p>Now close this tab.</p>')
              resolve(authCode)
            })
          })
      }

      async function requestGoogleForAccessTokens(OAuthClient, authorizationToken) {
          return new Promise((resolve, reject) => {
            OAuthClient.getToken(authorizationToken, (error, tokens) => {
              if (error) {
                return reject(error)
              }
    
              console.log('> [tasks-robot] Access tokens received!')
              resolve(tokens)
            })
          })
      }
    
      function setGlobalGoogleAuthentication(tokens) {
        OAuthClient.setCredentials(tokens);
        google.options({
          auth: OAuthClient
        })
      }
    
      async function stopWebServer(webServer) {
          return new Promise((resolve, reject) => {
            webServer.server.close(() => {
              resolve()
            })
          })
      }
    }

}

module.exports = robot;