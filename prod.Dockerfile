FROM node:20-alpine AS development

ENV NODE_ENV development

# Add a work directory
WORKDIR /app

RUN mkdir -p /home/node/app/.npm \
&& chown -R node:node /home/node/app/.npm

ENV npm_config_cache /home/node/app/.npm
# Cache and Install dependencies
# Copy app files
COPY . .

RUN npm i

RUN npm run build
# Expose port
EXPOSE 8000

# Start the app
CMD [ "npm", "run", "start" ]