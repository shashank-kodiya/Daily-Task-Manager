import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./App.css";
import {
  requestNotificationPermission,
  showNotification,
} from "./notification";
import { subscribeToPush } from "./pushNotifications";

function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
      } else {
        alert("Login successful!");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
      } else {
        alert("Registration successful. You can now login.");
        setIsLogin(true);
      }
    }
  }

  return (
    <div className={`auth-box ${isLogin ? "is-login" : "is-register"}`}>
      <div className="auth-heading">
        <span className="auth-kicker">YOUR DAY, IN GOOD ORDER</span>
        <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
        <p>
          {isLogin
            ? "Pick up right where you left off."
            : "A little more clarity starts here."}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <label>
          Email address
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit">
          {isLogin ? "Sign in" : "Create account"}
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <button
        className="switch-button"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Create a new account"
          : "Already have an account? Login"}
      </button>
    </div>
  );
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem("daily-task-manager-active-view");
    return savedView || "overview";
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = localStorage.getItem("daily-task-manager-selected-date");
    return savedDate || getLocalDateString();
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("Personal");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [expandedDescriptionTaskId, setExpandedDescriptionTaskId] = useState(null);
  const [descriptionModalTask, setDescriptionModalTask] = useState(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // Check logged-in user
  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "daily-task-manager-selected-date",
      selectedDate
    );
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem(
      "daily-task-manager-active-view",
      activeView
    );
  }, [activeView]);

  // Load selected date tasks
  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchCompletedTasks();
    }
  }, [session, selectedDate]);

  // Load all tasks for calendar indicators and dashboard statistics
  useEffect(() => {
    if (session) {
      fetchCalendarTasks();
    }
  }, [session]);

  // Request notification permission
  useEffect(() => {
    if (session) {
      requestNotificationPermission();
      subscribeToPush(session.user.id);
    }
  }, [session]);

  // Check task notifications
  useEffect(() => {
    if (!session || calendarTasks.length === 0) {
      return;
    }

    function checkNotifications() {
      const now = new Date();

      calendarTasks.forEach((task) => {
        if (task.status !== "pending") {
          return;
        }

        const taskDateTime = new Date(
          `${task.task_date}T${task.task_time}`
        );

        // Morning notification at 8:00 AM
        const morningDateTime = new Date(
          `${task.task_date}T08:00:00`
        );

        // 10 minutes before task
        const tenMinutesBefore = new Date(
          taskDateTime.getTime() - 10 * 60 * 1000
        );

        // Morning notification
        if (
          now >= morningDateTime &&
          now < new Date(morningDateTime.getTime() + 60 * 1000)
        ) {
          const key = `morning-${task.id}-${task.task_date}`;

          if (!localStorage.getItem(key)) {
            showNotification(
              "🌅 Morning Task Reminder",
              `You have a task today: ${task.title}`
            );

            localStorage.setItem(key, "sent");
          }
        }

        // 10-minute notification
        if (
          now >= tenMinutesBefore &&
          now < new Date(tenMinutesBefore.getTime() + 60 * 1000)
        ) {
          const key = `ten-minute-${task.id}-${task.task_date}`;

          if (!localStorage.getItem(key)) {
            showNotification(
              "⏰ Task Reminder",
              `${task.title} starts in 10 minutes.`
            );

            localStorage.setItem(key, "sent");
          }
        }
      });
    }

    checkNotifications();

    const interval = setInterval(checkNotifications, 30000);

    return () => clearInterval(interval);
  }, [session, calendarTasks]);

  async function checkUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
    } catch (error) {
      console.error("Session error:", error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  // Get tasks for selected date
  async function fetchTasks() {
    if (!session) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("task_date", selectedDate)
      .order("task_time");

    if (error) {
      console.error("Fetch tasks error:", error);
      return;
    }

    setTasks(data || []);
  }

  // Get all tasks for calendar dots and dashboard
  async function fetchCalendarTasks() {
    if (!session) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, description, task_date, task_time, status, priority, category")
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Calendar tasks error:", error);
      return;
    }

    setCalendarTasks(data || []);
  }

  // Get completed task history
  async function fetchCompletedTasks() {
    if (!session) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Completed tasks error:", error);
      return;
    }

    setCompletedTasks(data || []);
  }

  // Calendar date selection
  function handleCalendarChange(date) {
    setSelectedDate(getLocalDateString(date));
  }

  // Show dot on dates containing tasks
  function tileContent({ date, view }) {
    if (view !== "month") {
      return null;
    }

    const dateString = getLocalDateString(date);

    const hasTask = calendarTasks.some(
      (task) => task.task_date === dateString
    );

    if (hasTask) {
      return <div className="task-dot">●</div>;
    }

    return null;
  }

  // Add task
  async function addTask(e) {
    e.preventDefault();

    if (!title || !taskTime) {
      alert("Please enter task title and time.");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      user_id: session.user.id,
      title: title,
      description: description,
      task_date: selectedDate,
      task_time: taskTime,
      priority: priority,
      category: category,
      status: "pending",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setTaskTime("");
    setPriority("medium");
    setCategory("Personal");

    await fetchTasks();
    await fetchCalendarTasks();

    alert("Task added successfully!");
  }

  // Complete task
  async function completeTask(task) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchTasks();
    await fetchCompletedTasks();
    await fetchCalendarTasks();
  }

  async function deleteTask(task) {
    const shouldDelete = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`
    );

    if (!shouldDelete) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchTasks();
    await fetchCompletedTasks();
    await fetchCalendarTasks();
  }

  function startEditingTask(task) {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      task_date: task.task_date,
      task_time: task.task_time?.slice(0, 5) || "",
      priority: task.priority || "medium",
      category: task.category || "Personal",
    });
  }

  async function saveTaskEdits(e, task) {
    e.preventDefault();

    if (!editForm.title.trim() || !editForm.task_date || !editForm.task_time) {
      alert("Please enter a title, date, and time.");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editForm.title.trim(),
        description: editForm.description,
        task_date: editForm.task_date,
        task_time: editForm.task_time,
        priority: editForm.priority,
        category: editForm.category,
      })
      .eq("id", task.id)
      .eq("user_id", session.user.id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingTaskId(null);
    setEditForm(null);
    await fetchTasks();
    await fetchCompletedTasks();
    await fetchCalendarTasks();
  }

  // Dashboard statistics
  const totalTasks = calendarTasks.length;

  const isTaskOverdue = (task) => {
    if (task.status !== "pending") return false;

    const taskDateTime = new Date(`${task.task_date}T${task.task_time}`);
    return taskDateTime < new Date();
  };

  const completedCount = calendarTasks.filter(
    (task) => task.status === "completed"
  ).length;
  const pendingCount = calendarTasks.filter(
    (task) => task.status === "pending" && !isTaskOverdue(task)
  ).length;

  const pendingTasks = useMemo(
    () =>
      [...calendarTasks]
        .filter((task) => task.status === "pending" && !isTaskOverdue(task))
        .sort((a, b) => {
          const aDateTime = new Date(`${a.task_date}T${a.task_time}`).getTime();
          const bDateTime = new Date(`${b.task_date}T${b.task_time}`).getTime();
          return aDateTime - bDateTime;
        }),
    [calendarTasks]
  );

  const overdueTasks = useMemo(() => {
    return calendarTasks.filter((task) => isTaskOverdue(task));
  }, [calendarTasks]);

  const overdueCount = overdueTasks.length;

  const historyTasks = useMemo(() => {
    const completedHistory = completedTasks.map((task) => ({
      ...task,
      historyType: "completed",
      sortDate: task.completed_at || task.task_date,
    }));

    const overdueHistory = overdueTasks.map((task) => ({
      ...task,
      historyType: "overdue",
      sortDate: `${task.task_date}T${task.task_time}`,
    }));

    return [...completedHistory, ...overdueHistory].sort((a, b) => {
      const aTime = new Date(a.sortDate).getTime();
      const bTime = new Date(b.sortDate).getTime();
      return bTime - aTime;
    });
  }, [completedTasks, overdueTasks]);

  const completionRate =
    totalTasks === 0
      ? 0
      : Math.round((completedCount / totalTasks) * 100);

  // Logout
  async function logout() {
    await supabase.auth.signOut();
  }

  // Loading screen
  if (loading) {
    return <h2>Loading...</h2>;
  }

  // Login screen
  if (!session) {
    return (
      <div className="auth-container">
        <section className="auth-welcome">
          <div className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true">
              ✓
            </span>
            <span>Daily Task Manager</span>
          </div>

          <div className="auth-welcome-copy">
            <span className="auth-kicker">MAKE ROOM FOR WHAT MATTERS</span>
            <h1>A calmer way to get things done.</h1>
            <p>
              Bring your tasks, plans, and little wins into one clear view.
            </p>
          </div>

          <div
            className="auth-preview"
            aria-label="Example of today's task list"
          >
            <div className="auth-preview-topline">
              <span>Today</span>
              <span>03 / 05</span>
            </div>

            <div className="auth-progress">
              <span />
            </div>

            <div className="auth-preview-task is-complete">
              <span>✓</span> Review weekly plan
            </div>

            <div className="auth-preview-task">
              <span /> Send project update <time>10:30</time>
            </div>

            <div className="auth-preview-task">
              <span /> Take a proper lunch <time>12:00</time>
            </div>
          </div>

          <span className="auth-orbit auth-orbit-one" aria-hidden="true" />
          <span className="auth-orbit auth-orbit-two" aria-hidden="true" />
        </section>

        <AuthForm />
      </div>
    );
  }

  // Dashboard
  return (
    <div className="dashboard">
      <header>
        <h1>Daily Task Manager</h1>

        <div>
          <span>{session.user.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <nav className="dashboard-nav" aria-label="Task sections">
        {[
          ["overview", "Overview"],
          ["planner", "Select Date"],
          ["overdue", "Overdue", overdueCount],
          ["completed", "Completed", completedTasks.length],
          ["history", "History"],
        ].map(([view, label, count]) => (
          <button
            className={activeView === view ? "is-active" : ""}
            key={view}
            onClick={() => setActiveView(view)}
            aria-current={activeView === view ? "page" : undefined}
          >
            {label}
            {count !== undefined && <span>{count}</span>}
          </button>
        ))}
      </nav>

      <main>
        {/* Productivity Dashboard */}
        {activeView === "overview" && (
          <>
        <section className="dashboard-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">OVERVIEW</span>
              <h2>Productivity Dashboard</h2>
            </div>
            <span className="dashboard-date">
              {new Date().toLocaleDateString()}
            </span>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon">📋</span>
              <span className="stat-label">Total Tasks</span>
              <strong>{totalTasks}</strong>
            </div>

            <div className="stat-card completed-stat">
              <span className="stat-icon">✅</span>
              <span className="stat-label">Completed</span>
              <strong>{completedCount}</strong>
            </div>

            <div className="stat-card pending-stat">
              <span className="stat-icon">⏳</span>
              <span className="stat-label">Pending</span>
              <strong>{pendingCount}</strong>
            </div>

            <div className="stat-card overdue-stat">
              <span className="stat-icon">🔴</span>
              <span className="stat-label">Overdue</span>
              <strong>{overdueCount}</strong>
            </div>
          </div>

          <div className="completion-box">
            <div>
              <strong>Completion Rate</strong>
              <span>{completionRate}%</span>
            </div>
            <div className="completion-track">
              <div style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </section>

          </>
        )}

        {/* Overdue Tasks */}
        {activeView === "overdue" && <section className="dashboard-section overdue-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ACTION NEEDED</span>
              <h2>Overdue Tasks</h2>
            </div>
            <span className="overdue-badge">{overdueCount}</span>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="empty-dashboard">
              <span>✓</span>
              <p>No overdue tasks. You're up to date!</p>
            </div>
          ) : (
            <div className="overdue-list">
              {overdueTasks.map((task) => (
                <div className="overdue-card" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    {expandedDescriptionTaskId === task.id && task.description && (
                      <p className="task-description">{task.description}</p>
                    )}
                    <p>
                      {task.task_date} at {task.task_time}
                    </p>
                  </div>

                  <div className="task-badges">
                    <span className="category-badge">
                      {task.category || "Personal"}
                    </span>
                    <span className={`priority-badge ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>

                  <div className="overdue-actions">
                    {task.description && (
                      <button
                        type="button"
                        className="description-toggle-button"
                        onClick={() => setDescriptionModalTask(task)}
                      >
                        Read Description
                      </button>
                    )}
                    <button
                      className="overdue-delete-button"
                      onClick={() => deleteTask(task)}
                      aria-label={`Delete ${task.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* Calendar */}
        {activeView === "planner" && <section className="calendar-section">
          <h2>Select Task Date</h2>

          <Calendar
            onChange={handleCalendarChange}
            value={new Date(selectedDate + "T00:00:00")}
            tileContent={tileContent}
          />

          <h3>Selected Date: {selectedDate}</h3>
        </section>}

        {/* Add Task */}
        {activeView === "planner" && <section className="add-task">
          <h2>Add Task</h2>

          <form onSubmit={addTask}>
            <input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              placeholder="Task description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <label>Task Time</label>

            <input
              type="time"
              value={taskTime}
              onChange={(e) => setTaskTime(e.target.value)}
            />

            <label>Priority</label>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <label>Category</label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Study">Study</option>
              <option value="Work">Work</option>
              <option value="Personal">Personal</option>
              <option value="Health">Health</option>
              <option value="Other">Other</option>
            </select>

            <button type="submit">Add Task</button>
          </form>
        </section>}

        {/* Active tasks visible in dashboard */}
        {activeView === "overview" && (
          <section className="task-section">
            <h2>All Active Tasks</h2>

            {pendingTasks.length === 0 ? (
              <p>No active tasks available.</p>
            ) : (
              <div className="overdue-list">
                {pendingTasks.map((task) => (
                  <div
                    className={`task-card ${
                      (task.category || "Personal").toLowerCase()
                    } ${
                      new Date(`${task.task_date}T${task.task_time}`) < new Date()
                        ? "is-overdue"
                        : ""
                    }`}
                    key={task.id}
                  >
                    {editingTaskId === task.id && editForm ? (
                      <form
                        className="task-edit-form"
                        onSubmit={(e) => saveTaskEdits(e, task)}
                      >
                        <label>
                          Title
                          <input
                            name="title"
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({ ...editForm, title: e.target.value })
                            }
                            required
                          />
                        </label>

                        <label className="task-edit-description">
                          Description
                          <textarea
                            name="description"
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                          />
                        </label>

                        <label>
                          Date
                          <input
                            type="date"
                            name="task_date"
                            value={editForm.task_date}
                            onChange={(e) =>
                              setEditForm({ ...editForm, task_date: e.target.value })
                            }
                            required
                          />
                        </label>

                        <label>
                          Time
                          <input
                            type="time"
                            name="task_time"
                            value={editForm.task_time}
                            onChange={(e) =>
                              setEditForm({ ...editForm, task_time: e.target.value })
                            }
                            required
                          />
                        </label>

                        <label>
                          Priority
                          <select
                            name="priority"
                            value={editForm.priority}
                            onChange={(e) =>
                              setEditForm({ ...editForm, priority: e.target.value })
                            }
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </label>

                        <label>
                          Category
                          <select
                            name="category"
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                          >
                            <option value="Study">Study</option>
                            <option value="Work">Work</option>
                            <option value="Personal">Personal</option>
                            <option value="Health">Health</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>

                        <div className="task-edit-actions">
                          <button type="submit" className="task-save-button">
                            Save changes
                          </button>
                          <button
                            type="button"
                            className="task-cancel-button"
                            onClick={() => {
                              setEditingTaskId(null);
                              setEditForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="task-card-top">
                          <h3>{task.title}</h3>

                          <div className="task-badges">
                            <span className="category-badge">
                              {task.category || "Personal"}
                            </span>

                            <span className={`priority-badge ${task.priority}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        {task.description && (
                          <div className="description-buttons-row">
                            <button
                              type="button"
                              className="description-toggle-button"
                              onClick={() => setDescriptionModalTask(task)}
                            >
                              Read Description
                            </button>
                          </div>
                        )}

                        {expandedDescriptionTaskId === task.id && task.description && (
                          <p className="task-description">{task.description}</p>
                        )}

                        <p>
                          <strong>Date:</strong> {task.task_date}
                        </p>

                        <p>
                          <strong>Time:</strong> {task.task_time}
                        </p>

                        <p>
                          <strong>Category:</strong> {task.category || "Personal"}
                        </p>

                        <p>
                          <strong>Status:</strong>{" "}
                          {new Date(`${task.task_date}T${task.task_time}`) < new Date()
                            ? "overdue"
                            : task.status}
                        </p>

                        <div className="task-actions">
                          <button
                            className="task-complete-button"
                            onClick={() => completeTask(task)}
                          >
                            Mark Completed
                          </button>

                          <button
                            className="task-edit-button"
                            onClick={() => startEditingTask(task)}
                          >
                            Edit
                          </button>

                          <button
                            className="task-delete-button"
                            onClick={() => deleteTask(task)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {descriptionModalTask && (
          <div className="description-modal-backdrop" onClick={() => setDescriptionModalTask(null)}>
            <div
              className="description-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-description-title"
            >
              <div className="description-modal-header">
                <h3 id="task-description-title">{descriptionModalTask.title}</h3>
                <button
                  type="button"
                  className="description-modal-close"
                  onClick={() => setDescriptionModalTask(null)}
                  aria-label="Close task description"
                >
                  ×
                </button>
              </div>

              <p className="description-modal-meta">
                {descriptionModalTask.task_date} at {descriptionModalTask.task_time}
              </p>

              <div className="description-modal-body">
                {descriptionModalTask.description ? (
                  <p>{descriptionModalTask.description}</p>
                ) : (
                  <p>No description added for this task.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recently completed tasks */}
        {activeView === "completed" && <section className="history-section completed-list-section">
          <h2>Completed Tasks</h2>

          {completedTasks.length === 0 ? (
            <p>No completed tasks yet.</p>
          ) : (
            <div className="completed-task-list">
              {completedTasks.map((task) => (
                <article className="completed-task-row" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <p>{task.task_date} at {task.task_time}</p>
                  </div>
                  <span className="completed-status">Completed</span>
                </article>
              ))}
            </div>
          )}
        </section>}

        {/* Completed & Overdue History */}
        {activeView === "history" && <section className="history-section">
          <h2>Completed & Overdue History</h2>

          {historyTasks.length === 0 ? (
            <p>No completed or overdue tasks yet.</p>
          ) : (
            historyTasks.map((task) => (
              <div
                className={`history-card ${task.historyType}`}
                key={`${task.historyType}-${task.id}`}
              >
                <div className="task-card-top">
                  <h3>{task.title}</h3>

                  <span className="category-badge">
                    {task.category || "Personal"}
                  </span>
                </div>

                <p>
                  <strong>Task Date:</strong> {task.task_date}
                </p>

                <p>
                  <strong>Task Time:</strong> {task.task_time}
                </p>

                <p>
                  <strong>Status:</strong> {task.historyType === "overdue" ? "Overdue" : "Completed"}
                </p>

                <p>
                  <strong>{task.historyType === "overdue" ? "Due At:" : "Completed At:"}</strong>{" "}
                  {task.historyType === "overdue"
                    ? new Date(`${task.task_date}T${task.task_time}`).toLocaleString()
                    : new Date(task.completed_at).toLocaleString()}
                </p>

                <p>
                  <strong>Priority:</strong> {task.priority}
                </p>

                {task.description && (
                  <button
                    type="button"
                    className="description-toggle-button"
                    onClick={() => setDescriptionModalTask(task)}
                  >
                    Read Description
                  </button>
                )}
              </div>
            ))
          )}
        </section>}
      </main>
    </div>
  );
}

export default App;
