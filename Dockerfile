FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn prisma:migrate
RUN yarn prisma:generate
RUN yarn build

EXPOSE 3000

CMD ["node", "dist/index.js"]
