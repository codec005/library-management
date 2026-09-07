package com.college.library.identity;

import com.college.library.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class UserAccount extends BaseEntity {

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String department;

    @Column(nullable = false)
    private boolean active = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    private Set<UserRole> roles = new HashSet<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserIdentifier> identifiers = new HashSet<>();

    protected UserAccount() {
    }

    public UserAccount(String fullName, String department, Set<UserRole> roles) {
        this.fullName = fullName;
        this.department = department;
        this.roles = roles;
    }

    public String getFullName() {
        return fullName;
    }

    public String getDepartment() {
        return department;
    }

    public boolean isActive() {
        return active;
    }

    public Set<UserRole> getRoles() {
        return roles;
    }

    public Set<UserIdentifier> getIdentifiers() {
        return identifiers;
    }

    public void deactivate() {
        active = false;
    }

    public void activate() {
        active = true;
    }

    public void addIdentifier(UserIdentifier identifier) {
        identifiers.add(identifier);
        identifier.assignTo(this);
    }
}
