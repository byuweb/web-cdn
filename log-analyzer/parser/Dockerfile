FROM node:8

WORKDIR /app/

COPY package.json yarn.lock /app/

RUN ["npm", "i"]

COPY . .

RUN ["npm", "run", "build"]

CMD ["node", "lib/cli.js"]
