package com.arroba.taskapi.task;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class TaskService {

    private final TaskRepository repo;

    public TaskService(TaskRepository repo) {
        this.repo = repo;
    }

    public List<Task> findAll() {
        return repo.findAll();
    }

    public Task create(Task task) {
        task.setCompleted(false);
        return repo.save(task);
    }

    public Task toggle(Long id) {
        Task t = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        t.setCompleted(!t.isCompleted());
        return repo.save(t);
    }

    public void delete(Long id) {
        repo.deleteById(id);
    }
    public Task update(Long id, Task updatedTask) {
    Task existing = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));

    if (updatedTask.getTitle() != null) {
        existing.setTitle(updatedTask.getTitle());
    }

    existing.setStartAt(updatedTask.getStartAt());
    existing.setEndAt(updatedTask.getEndAt());

    return repo.save(existing);
}
}
