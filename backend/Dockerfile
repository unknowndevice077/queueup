# syntax=docker/dockerfile:1

# ---- Build stage: compile and package the Spring Boot jar ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml checkstyle.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests -Dcheckstyle.skip -Djacoco.skip=true \
    && cp target/queueup-backend-*.jar /workspace/app.jar

# ---- Runtime stage: slim JRE, non-root user ----
FROM eclipse-temurin:21-jre
RUN groupadd --system queueup && useradd --system --gid queueup --home /app queueup
WORKDIR /app
COPY --from=build /workspace/app.jar app.jar
USER queueup
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
