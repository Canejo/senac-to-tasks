const robots = {
    senac: require('./robots/senac-tasks.js'),
    tasks: require('./robots/google-tasks.js')
  }
  
  async function start() {
    const tasks = await robots.senac();
    await robots.tasks(tasks);
  }
  
  start();
  