FROM node:18-alpine

COPY /docker /scripts

COPY /functions /functions
RUN /scripts/package-restore.sh

EXPOSE 8100

CMD [ "sh", "/scripts/start.sh" ]
