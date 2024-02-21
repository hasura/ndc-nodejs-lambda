FROM node:18-alpine

RUN apk add jq

COPY /docker /scripts

COPY /functions /functions
RUN /scripts/package-restore.sh

EXPOSE 8080

CMD [ "sh", "/scripts/start.sh" ]
