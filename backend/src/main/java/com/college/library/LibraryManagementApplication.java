package com.college.library;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LibraryManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(LibraryManagementApplication.class, args); //Startup application entrypoint when we start the backend
        // Login functionalities in auth/ (when url has /api/auth it goes to AuthController) also it depends on identity/ folder
        // Available books /add books/remove books catolog/
        // Issue book logic circulation/
    }
}
