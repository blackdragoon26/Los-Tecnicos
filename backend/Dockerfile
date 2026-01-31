# Stage 1: Build the Go binary
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application
# -ldflags="-w -s" strips debugging information, making the binary smaller
# CGO_ENABLED=0 is important for creating a static binary that can run in a scratch image
RUN CGO_ENABLED=0 go build -ldflags="-w -s" -o /app/main ./cmd/api

# Stage 2: Create the final, minimal image
FROM scratch

WORKDIR /app

# Copy the static binary from the builder stage
COPY --from=builder /app/main .

# Expose the port the app runs on
EXPOSE 8080

# Set the entrypoint
ENTRYPOINT ["/app/main"]
