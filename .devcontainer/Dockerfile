FROM node:latest

ENV DENO_INSTALL=/home/node/deno
RUN mkdir -p ${DENO_INSTALL}

ENV DENO_DIR=${DENO_INSTALL}/.cache/deno
ENV PATH=${DENO_INSTALL}/bin:${PATH}

# Install Deno 
RUN curl -fsSL https://deno.land/x/install/install.sh | sh 

# Install Deno Deploy CLI
RUN deno install -fA jsr:@deno/deployctl --global

RUN chown -R node ${DENO_INSTALL}
RUN chgrp -R node ${DENO_INSTALL}

# Install Appwrite CLI
RUN npm install -g appwrite-cli

# Avoid running as root
ARG DOCKER_GID=1001
RUN groupadd -g $DOCKER_GID docker
RUN usermod -aG docker node

# Set working directory
WORKDIR /home/node/app

USER node
