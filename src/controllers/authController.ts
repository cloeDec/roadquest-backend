import { Request, Response } from "express";
import * as authService from "../services/authService";

const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

export const register = async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body);

    res.status(201).json({
      message: "User created successfully",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof authService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof authService.ConflictError) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);

    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      clientIp,
    });

    res.json({
      message: "Login successful",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof authService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof authService.RateLimitError) {
      return res.status(429).json({ error: error.message });
    }
    if (error instanceof authService.AuthenticationError) {
      return res.status(401).json({
        error: error.message,
        remainingAttempts: error.remainingAttempts,
      });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = (req: Request, res: Response) => {
  try {
    authService.logout(req.token);
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
