ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache python3 tzdata

COPY run.sh /
COPY app /app
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
