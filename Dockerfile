# docker build -t senac-to-tasks:latest .
# docker run -d --name senac-to-tasks senac-to-tasks:latest
FROM camilin87/node-cron:latest

ENV TASK_SCHEDULE='0 22 * * *'
COPY . /usr/src/app