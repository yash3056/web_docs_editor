
FROM node:22

WORKDIR /app

RUN apt-get update && \
    apt-get install -y git

RUN git clone https://github.com/yash3056/web_docs_editor/ -b 1.0.0 .

RUN npm ci
RUN npm rebuild

EXPOSE 3000

CMD ["npm", "start"]