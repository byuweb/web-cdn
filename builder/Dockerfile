FROM node:8

RUN apt-get update \
    && apt-get install -y --no-install-recommends python-dev \
    && curl https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py \
    && python /tmp/get-pip.py --no-wheel \
    && rm -rf /var/lib/apt/lists/* \
    && rm /tmp/get-pip.py

RUN pip --version \
    && pip install --no-cache-dir awscli

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

ADD package.json package-lock.json /usr/src/app/

RUN npm install \
    && npm cache clean --force

ADD . /usr/src/app/

CMD node index.js
