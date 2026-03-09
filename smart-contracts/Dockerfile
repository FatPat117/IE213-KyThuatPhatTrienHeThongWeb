FROM ghcr.io/foundry-rs/foundry:latest

USER root
WORKDIR /app

# Copy the entire smart-contracts directory
COPY . .

# Khởi tạo một git repository ảo để có thể gọi forge install
RUN git init && git config --global user.email "you@example.com" && git config --global user.name "Your Name" && git add . && git commit -m "init"

# Tiến hành cài submodules thông qua git và foundry
RUN forge install foundry-rs/forge-std
RUN forge install OpenZeppelin/openzeppelin-contracts

# Cuối cùng mới build
RUN forge build

# Set the entrypoint to a shell script that will handle deployment and address extraction
ENTRYPOINT ["/bin/sh", "./deploy-docker.sh"]
