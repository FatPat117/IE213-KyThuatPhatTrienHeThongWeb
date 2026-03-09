FROM ghcr.io/foundry-rs/foundry:latest

USER root
WORKDIR /app

# Copy the entire smart-contracts directory
COPY . .

# Build the contracts
RUN forge build

# Set the entrypoint to a shell script that will handle deployment and address extraction
ENTRYPOINT ["/bin/sh", "./deploy-docker.sh"]
