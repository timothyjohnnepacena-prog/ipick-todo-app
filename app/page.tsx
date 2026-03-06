"use client";
import React, { useState, useEffect, useCallback, memo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    DndContext, closestCorners, PointerSensor, useSensor, useSensors,
    useDroppable, DragOverlay, defaultDropAnimationSideEffects,
    DragStartEvent, DragOverEvent, DragEndEvent
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useModal } from "@/components/Modal";

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDone, 2500);
        return () => clearTimeout(t);
    }, [onDone]);
    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-[#9E2A2B] text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold uppercase tracking-widest animate-scaleIn pointer-events-none">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            {message}
        </div>
    );
}

function useToast() {
    const [toast, setToast] = useState<string | null>(null);
    const show = useCallback((msg: string) => setToast(msg), []);
    const node = toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null;
    return { show, node };
}

interface Task {
    _id: string;
    text: string;
    listId: string;
    listName?: string;
    displayName: string;
    createdAt?: string;
    completedAt?: string;
    completed?: boolean;
    status?: string;
}

interface List {
    _id: string;
    name: string;
}

interface LogEntry {
    _id: string;
    action: string;
    details: string;
    displayName: string;
    createdAt: string;
}

interface ActiveUser {
    id: string;
    name: string;
}

interface TaskCardProps {
    task: Task;
    fetchData?: (silent?: boolean) => void;
    isOverlay?: boolean;
    isDragging?: boolean;
    setTasks?: React.Dispatch<React.SetStateAction<Task[]>>;
    currentUserName?: string;
    showToast?: (msg: string) => void;
}

const TaskCard = memo(({ task, fetchData, isOverlay, isDragging, setTasks, currentUserName, showToast }: TaskCardProps) => {
    const { showPrompt, showConfirm, showAlert, showSelect } = useModal();
    const [menuOpen, setMenuOpen] = useState(false);
    const isOwner = !currentUserName || task.displayName.toLowerCase() === currentUserName.toLowerCase();

    const currentStatus = task.status || "pending";
    const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
        pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-600" },
        in_progress: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-600" },
        done: { label: "Done", bg: "bg-emerald-100", text: "text-emerald-600" },
    };
    const badge = statusConfig[currentStatus] || statusConfig.pending;

    const handleEditStatus = async () => {
        setMenuOpen(false);
        if (!isOwner) { showToast?.("You can't change someone else's task status"); return; }

        const selected = await showSelect({
            title: "Edit Status",
            message: "Choose a new status for this task.",
            currentValue: currentStatus,
            options: [
                { value: "pending", label: "Pending", description: "Task has not been started yet", color: "#d97706", icon: "⏳" },
                { value: "in_progress", label: "In Progress", description: "Task is currently being worked on", color: "#2563eb", icon: "🔄" },
                { value: "done", label: "Done", description: "Task has been completed", color: "#12A55C", icon: "✓" },
            ],
        });

        if (!selected || selected === currentStatus) return;

        if (selected === "done") {
            const yes = await showConfirm({ title: "Verify Task", message: "Verify or make sure that it is done. Proceed?", variant: "success", confirmText: "Yes, Done!" });
            if (yes) {
                if (setTasks) setTasks(prev => prev.map(t => t._id === task._id ? { ...t, completed: true, status: "done" } : t));
                fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "mark_done", taskId: task._id }) }).then(() => {
                    if (fetchData) fetchData(true);
                });
            }
        } else {
            if (setTasks) setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: selected } : t));
            fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "update_status", taskId: task._id, status: selected }) }).then(() => {
                if (fetchData) fetchData(true);
            });
        }
    };

    return (
        <div
            className={`bg-white p-4 rounded-xl border shadow-sm touch-none transition-all group ${isOverlay ? 'border-[#F37A22] shadow-2xl scale-105 rotate-2 cursor-grabbing' :
                isOwner ? 'border-slate-100 cursor-grab' : 'border-slate-200 cursor-not-allowed opacity-80'
                } ${isDragging ? 'opacity-30' : 'opacity-100'}`}
        >
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[9px] font-black uppercase tracking-wider ${badge.bg} ${badge.text} px-2 py-0.5 rounded-md`}>{badge.label}</span>
                <div className="relative">
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden text-xs font-bold">
                                {!task.completed && (
                                    <>
                                        <button
                                            onClick={async () => {
                                                setMenuOpen(false);
                                                if (!isOwner) { showToast?.("You can't rename someone else's task"); return; }
                                                const newText = await showPrompt({ title: "Rename Task", placeholder: "Enter new task name...", defaultValue: task.text, confirmText: "Save" });
                                                if (newText && newText !== task.text) {
                                                    if (setTasks) setTasks(prev => prev.map(t => t._id === task._id ? { ...t, text: newText } : t));
                                                    fetch("/api/todos", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ type: "edit_task", taskId: task._id, newText })
                                                    }).then(async res => {
                                                        if (!res.ok) await showAlert({ title: "Permission Denied", message: "You don't have permission to rename this task.", variant: "danger" });
                                                        if (fetchData) fetchData(true);
                                                    });
                                                }
                                            }}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${isOwner ? 'text-blue-500 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed'}`}
                                        >
                                            ✎ Rename
                                        </button>
                                        <button
                                            onClick={handleEditStatus}
                                            className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${isOwner ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'}`}
                                        >
                                            ⚡ Edit Status
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={async () => {
                                        setMenuOpen(false);
                                        if (!isOwner) { showToast?.("You can't delete someone else's task"); return; }
                                        const yes = await showConfirm({ title: "Delete Task", message: `Remove "${task.text}" from the board?`, variant: "danger", confirmText: "Delete" });
                                        if (yes) {
                                            if (setTasks) setTasks(prev => prev.filter(t => t._id !== task._id));
                                            fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task._id }) }).then(async res => {
                                                if (!res.ok) await showAlert({ title: "Permission Denied", message: "You don't have permission to delete this task.", variant: "danger" });
                                                if (fetchData) fetchData(true);
                                            });
                                        }
                                    }}
                                    className={`w-full text-left px-4 py-3 transition-colors ${isOwner ? 'text-[#9E2A2B] hover:bg-[#9E2A2B]/10' : 'text-slate-300 cursor-not-allowed'}`}
                                >
                                    ✕ Remove
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <p className="font-semibold text-slate-700 text-xs mb-3 leading-snug">{task.text}</p>
            <div className="flex items-center mt-2 pt-2 border-t border-slate-50">
                <span className="text-[10px] font-bold text-[#F37A22] bg-[#F37A22]/10 px-2 py-0.5 rounded-md uppercase">
                    {task.displayName}
                </span>
                {!isOwner && (
                    <svg className="w-3 h-3 text-slate-400 shrink-0 ml-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                )}
            </div>
        </div >
    );
});
TaskCard.displayName = "TaskCard";

function SortableTask({ task, fetchData, setTasks, currentUserName, showToast }: { task: Task; fetchData: (silent?: boolean) => void; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; currentUserName: string; showToast: (msg: string) => void }) {
    const isOwner = task.displayName.toLowerCase() === currentUserName.toLowerCase();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task._id, data: { type: "Task", task },
        disabled: !isOwner,
    });
    const style = { transform: CSS.Translate.toString(transform), transition };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isOwner) {
            e.stopPropagation();
            showToast("You can only move your own tasks");
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...(isOwner ? listeners : { onPointerDown: handlePointerDown })}
        >
            <TaskCard task={task} fetchData={fetchData} setTasks={setTasks} isDragging={isDragging} currentUserName={currentUserName} showToast={showToast} />
        </div>
    );
}

const KanbanColumn = memo(({ list, tasks, fetchData, setTasks, setLists, currentUserName, showToast }: { list: List; tasks: Task[]; fetchData: (silent?: boolean) => void; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; setLists: React.Dispatch<React.SetStateAction<List[]>>; currentUserName: string; showToast: (msg: string) => void }) => {
    const { setNodeRef } = useDroppable({ id: list._id, data: { type: "List", list } });
    const [menuOpen, setMenuOpen] = useState(false);
    const listTasks = tasks.filter(t => t.listId === list._id && !t.completed);
    const { showPrompt, showConfirm, showAlert } = useModal();

    const handleAddTask = async () => {
        const text = await showPrompt({ title: "New Task", placeholder: "What needs to be done?", confirmText: "Add Task" });
        if (text) {
            setTasks(prev => [...prev, { _id: `temp-${Date.now()}`, text, listId: list._id, order: 999, displayName: currentUserName, createdAt: new Date().toISOString() }]);
            fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "task", data: { text, listId: list._id } }) }).then(() => fetchData(true));
        }
    };

    const handleRenameList = async () => {
        setMenuOpen(false);
        const newName = await showPrompt({ title: "Rename List", placeholder: "Enter new list name...", defaultValue: list.name, confirmText: "Rename" });
        if (newName && newName !== list.name) {
            setLists(prev => prev.map(l => l._id === list._id ? { ...l, name: newName } : l));
            fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", listId: list._id, newName }) }).then(() => fetchData(true));
        }
    };

    const handleDeleteList = async () => {
        setMenuOpen(false);

        if (listTasks.length > 0) {
            await showAlert({
                title: "Delete Failed",
                message: "Empty the list first.",
                variant: "danger"
            });
            return;
        }

        const yes = await showConfirm({ title: "Delete List", message: `This will permanently delete "${list.name}".`, variant: "danger", confirmText: "Delete List" });
        if (yes) {
            setLists(prev => prev.filter(l => l._id !== list._id));
            setTasks(prev => prev.filter(t => t.listId !== list._id || t.completed));
            fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", listId: list._id }) }).then(() => fetchData(true));
        }
    };

    return (
        <div ref={setNodeRef} className="bg-slate-100/80 backdrop-blur-md w-[85vw] max-w-[320px] md:min-w-[280px] md:w-[280px] snap-center p-4 rounded-2xl border border-slate-200/60 flex flex-col relative shadow-sm hover:shadow-md transition-shadow shrink-0">
            <div className="flex justify-between items-center mb-4 px-1 relative z-50">
                <h2 className="font-bold text-slate-600 uppercase text-[11px] tracking-wider truncate mr-2">{list.name}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold bg-[#12A55C]/10 text-[#12A55C] rounded-md shadow-sm">
                        {listTasks.length}
                    </span>
                    <button onClick={handleAddTask} className="h-5 w-5 flex items-center justify-center bg-white text-[#12A55C] rounded-md shadow-sm hover:bg-[#12A55C] hover:text-white transition-colors text-[14px] font-bold" title="Add Task">+</button>
                    <div className="relative h-5">
                        <button onClick={() => setMenuOpen(!menuOpen)} className="h-5 w-5 flex items-center justify-center bg-white text-slate-400 rounded-md shadow-sm hover:bg-slate-200 transition-colors text-[10px] font-black tracking-widest pb-1">...</button>
                        {menuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden text-xs font-bold">
                                    <button onClick={handleRenameList} className="w-full text-left px-4 py-3 text-slate-600 hover:bg-slate-50 border-b border-slate-50 transition-colors">Rename List</button>
                                    <button onClick={handleDeleteList} className="w-full text-left px-4 py-3 text-[#9E2A2B] hover:bg-[#9E2A2B]/10 transition-colors">Delete List</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <SortableContext id={list._id} items={listTasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3 flex-1 min-h-[150px] relative z-10">
                    {listTasks.map(task => <SortableTask key={task._id} task={task} fetchData={fetchData} setTasks={setTasks} currentUserName={currentUserName} showToast={showToast} />)}
                </div>
            </SortableContext>
        </div>
    );
});
KanbanColumn.displayName = "KanbanColumn";

function NewColumnButton({ fetchData, setLists }: { fetchData: (silent?: boolean) => void; setLists: React.Dispatch<React.SetStateAction<List[]>> }) {
    const { showPrompt } = useModal();
    return (
        <button
            onClick={async () => {
                const name = await showPrompt({ title: "New Column", placeholder: "Enter column name...", confirmText: "Create" });
                if (name) {
                    setLists(prev => [...prev, { _id: `temp-${Date.now()}`, name }]);
                    fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", data: { name } }) }).then(() => fetchData(true));
                }
            }}
            className="w-[85vw] max-w-[320px] md:min-w-[280px] md:w-[280px] snap-center border-2 border-dashed border-slate-300 rounded-2xl p-6 text-slate-400 font-bold hover:bg-slate-50 hover:border-[#F37A22] hover:text-[#F37A22] transition-all text-xs uppercase tracking-widest relative z-10 bg-white/60 backdrop-blur-sm shrink-0"
        >
            + New Column
        </button>
    );
}

const ITEMS_PER_PAGE = 10;

export default function Home() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("board");
    const [lists, setLists] = useState<List[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [fetching, setFetching] = useState(true);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [finishedPage, setFinishedPage] = useState(1);
    const [logsPage, setLogsPage] = useState(1);
    const { show: showToast, node: toastNode } = useToast();

    const nickname = session?.user?.name || "User";
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setFetching(true);
        try {
            const userQuery = selectedUsers.length ? `users=${selectedUsers.join(",")}&` : "";
            const res = await fetch(`/api/todos?${userQuery}t=${Date.now()}`, {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache"
                }
            });
            if (!res.ok) return;
            const data = await res.json();
            setLists(data.lists || []);
            setTasks(data.tasks || []);
            setLogs(data.logs || []);
            if (data.users) {
                setActiveUsers(data.users.map((u: { _id: string; name: string }) => ({
                    id: u._id,
                    name: u.name
                })));
            }
        } finally { setFetching(false); }
    }, [selectedUsers]);

    useEffect(() => {
        if (status === "unauthenticated") router.push("/auth/signin");
    }, [status, router]);

    useEffect(() => {
        if (session) fetchData();
    }, [session, fetchData]);

    const handleFilterToggle = (userId: string) => {
        setFetching(true);
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(e => e !== userId) : [...prev, userId]
        );
    };

    const onDragStart = (event: DragStartEvent) => {
        const task = tasks.find(t => t._id === event.active.id);
        if (!task) return;
        if (task.displayName.toLowerCase() !== nickname.toLowerCase()) {
            showToast("You can only move your own tasks");
            return;
        }
        setActiveTask(task);
    };

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        if (activeId === overId) return;
        const isActiveTask = active.data.current?.type === "Task";
        const isOverTask = over.data.current?.type === "Task";
        const isOverList = over.data.current?.type === "List";
        if (!isActiveTask) return;
        setTasks((prev) => {
            const activeIndex = prev.findIndex((t) => t._id === activeId);
            if (activeIndex === -1) return prev;
            if (isOverTask) {
                const overIndex = prev.findIndex((t) => t._id === overId);
                if (overIndex === -1) return prev;
                if (prev[activeIndex].listId !== prev[overIndex].listId) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = { ...newTasks[activeIndex], listId: prev[overIndex].listId };
                    return arrayMove(newTasks, activeIndex, overIndex);
                }
                return arrayMove(prev, activeIndex, overIndex);
            }
            if (isOverList && prev[activeIndex].listId !== overId) {
                const newTasks = [...prev];
                newTasks[activeIndex] = { ...newTasks[activeIndex], listId: overId };
                return newTasks;
            }
            return prev;
        });
    };

    const onDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) {
            fetchData(true);
            return;
        }
        const activeId = String(active.id);
        const overId = String(over.id);
        const isOverTask = over.data.current?.type === "Task";
        let updatedTasks = [...tasks];
        if (isOverTask && activeId !== overId) {
            const activeIndex = updatedTasks.findIndex((t) => t._id === activeId);
            const overIndex = updatedTasks.findIndex((t) => t._id === overId);
            if (activeIndex !== -1 && overIndex !== -1) {
                updatedTasks = arrayMove(updatedTasks, activeIndex, overIndex);
                setTasks(updatedTasks);
            }
        }
        const draggedTask = updatedTasks.find(t => t._id === activeId);
        if (!draggedTask) return;
        const destList = lists.find(l => l._id === draggedTask.listId);
        const logMessage = `Updated position for "${draggedTask.text}" in "${destList?.name || 'board'}"`;
        fetch("/api/todos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bulk: true, tasks: updatedTasks, logMessage })
        }).then(res => {
            if (!res.ok) fetchData(true);
        }).catch(() => fetchData(true));
    };

    if (status === "loading") {
        return <div className="min-h-screen bg-[#F1F3F6] flex items-center justify-center font-black text-[#12A55C] animate-pulse text-sm tracking-widest uppercase">LOADING IPICK BOARD...</div>;
    }

    if (session) {
        return (
            <div className="flex flex-col md:flex-row h-screen bg-[#F1F3F6] overflow-hidden text-slate-800 relative">
                {fetching && (
                    <div className="fixed bottom-6 right-6 bg-white px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2 z-[100] animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-[#12A55C]"></div>
                        <span className="text-[10px] font-bold text-slate-500 tracking-wider">UPDATING...</span>
                    </div>
                )}
                <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-40 shrink-0">
                    <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-8 object-contain" />
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 hover:text-[#12A55C] focus:outline-none">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                    </div>
                </div>
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 bg-slate-800/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
                )}
                <aside className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out z-50 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'md:w-20' : 'w-64'} shrink-0 shadow-xl md:shadow-sm`}>
                    <div className={`p-5 hidden md:flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-100`}>
                        {!isSidebarCollapsed && <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-14 object-contain" />}
                        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-400 hover:text-[#12A55C] transition-colors p-1 rounded-md hover:bg-slate-50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                        </button>
                    </div>
                    <nav className="flex-1 mt-6 px-3 space-y-2">
                        <button onClick={() => { setActiveTab("board"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "board" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" /></svg>
                            <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>To Do Board</span>
                        </button>
                        <button onClick={() => { setActiveTab("finished"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "finished" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" /></svg>
                            <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Finished Tasks</span>
                        </button>
                        <button onClick={() => { setActiveTab("logs"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "logs" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                            <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Activity Logs</span>
                        </button>
                    </nav>
                    <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
                        <div className={`px-2 mb-1 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Logged in as</p>
                            <p className="text-sm font-bold text-slate-700 truncate">{nickname}</p>
                        </div>
                        <button onClick={() => signOut()} className={`w-full flex items-center p-3 rounded-xl transition-colors font-bold text-sm text-[#9E2A2B] hover:bg-[#9E2A2B]/10 ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
                            <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Log Out</span>
                        </button>
                    </div>
                </aside>
                <main className="flex-1 flex flex-col h-full overflow-auto p-3 md:p-6 relative">
                    {toastNode}
                    {activeTab === "board" && (
                        <div className="relative bg-white rounded-3xl p-2 md:p-8 border border-slate-200 shadow-sm overflow-auto flex-1 flex flex-col min-h-0">
                            <div className="absolute inset-0 bg-[url('/ipick-logo-navbar.png')] bg-center bg-no-repeat bg-[length:70%] md:bg-[length:35%] opacity-[0.12] mix-blend-multiply pointer-events-none z-0"></div>
                            <div className="relative z-20 w-full bg-slate-50/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex flex-wrap gap-2 md:gap-4 items-center shrink-0">
                                <span className="text-[10px] md:text-xs font-black uppercase text-slate-400 px-1">Filter Board:</span>
                                <button
                                    onClick={() => { setFetching(true); setSelectedUsers([]); }}
                                    className={`px-4 md:px-5 py-1.5 md:py-2 rounded-xl text-[10px] md:text-[11px] font-bold border transition-colors ${selectedUsers.length === 0 ? 'bg-[#12A55C] text-white border-[#12A55C]' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                >
                                    ALL
                                </button>
                                {activeUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleFilterToggle(user.id)}
                                        className={`px-4 md:px-5 py-1.5 md:py-2 rounded-xl text-[10px] md:text-[11px] font-bold border transition-colors ${selectedUsers.includes(user.id) ? 'bg-[#F37A22] text-white border-[#F37A22] shadow-md shadow-[#F37A22]/20' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:border-[#F37A22]/40'}`}
                                    >
                                        {user.name.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
                                <div className="relative z-10 flex gap-4 md:gap-6 items-start overflow-x-auto pb-4 snap-x snap-mandatory flex-1">
                                    {lists.map(list => <KanbanColumn key={list._id} list={list} tasks={tasks} fetchData={fetchData} setTasks={setTasks} setLists={setLists} currentUserName={nickname} showToast={showToast} />)}
                                    <NewColumnButton fetchData={fetchData} setLists={setLists} />
                                </div>
                                <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
                                    {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    )}
                    {activeTab === "finished" && (() => {
                        const finishedTasks = tasks.filter(t => t.completed);
                        const totalFinishedPages = Math.max(1, Math.ceil(finishedTasks.length / ITEMS_PER_PAGE));
                        const paginatedFinished = finishedTasks.slice((finishedPage - 1) * ITEMS_PER_PAGE, finishedPage * ITEMS_PER_PAGE);
                        return (
                            <div className="relative bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-sm overflow-auto flex-1 flex flex-col h-full">
                                <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black text-[#12A55C] tracking-tight">Finished Tasks Report</h2>
                                        <p className="text-slate-400 text-xs md:text-sm mt-1">Summary of all verified completed tasks.</p>
                                    </div>
                                </div>
                                {finishedTasks.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                                        <h3 className="font-bold text-slate-500 mb-1">No Finished Tasks</h3>
                                        <p className="text-xs md:text-sm text-slate-400 max-w-sm">When you mark a task as done on the To Do Board, it will appear here.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b-2 border-slate-200">
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">List</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Task Name</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Finished By</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Date Created</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Date Finished</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedFinished.map((task) => {
                                                        const listName = task.listName || lists.find(l => l._id === task.listId)?.name || "Deleted List";
                                                        const finishedDate = task.completedAt || task.createdAt;
                                                        return (
                                                            <tr key={task._id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                                                <td className="py-3 px-4">
                                                                    <span className="text-xs font-bold text-[#12A55C] bg-[#12A55C]/10 px-2.5 py-1 rounded-lg">{listName}</span>
                                                                </td>
                                                                <td className="py-3 px-4 text-sm font-semibold text-slate-700">{task.text}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className="text-xs font-bold text-[#F37A22] bg-[#F37A22]/10 px-2.5 py-1 rounded-lg">{task.displayName}</span>
                                                                </td>
                                                                <td className="py-3 px-4 text-xs text-slate-500 font-medium">
                                                                    {task.createdAt ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(task.createdAt)) : '—'}
                                                                </td>
                                                                <td className="py-3 px-4 text-xs text-slate-500 font-medium">
                                                                    {finishedDate ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(finishedDate)) : '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Mobile Cards */}
                                        <div className="md:hidden space-y-3">
                                            {paginatedFinished.map((task) => {
                                                const listName = task.listName || lists.find(l => l._id === task.listId)?.name || "Deleted List";
                                                const finishedDate = task.completedAt || task.createdAt;
                                                return (
                                                    <div key={task._id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-[#12A55C] bg-[#12A55C]/10 px-2.5 py-1 rounded-lg uppercase">{listName}</span>
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-700">{task.text}</p>
                                                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                                            <span className="text-[10px] font-bold text-[#F37A22] bg-[#F37A22]/10 px-2 py-0.5 rounded-md uppercase">{task.displayName}</span>
                                                            <div className="text-right">
                                                                <p className="text-[9px] text-slate-400 font-medium">
                                                                    Created: {task.createdAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(task.createdAt)) : '—'}
                                                                </p>
                                                                <p className="text-[9px] text-slate-400 font-medium">
                                                                    Finished: {finishedDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(finishedDate)) : '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Pagination */}
                                        {totalFinishedPages > 1 && (
                                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setFinishedPage(p => Math.max(1, p - 1))}
                                                    disabled={finishedPage === 1}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                >
                                                    ← Prev
                                                </button>
                                                <span className="text-[11px] font-bold text-slate-400 px-2">
                                                    Page {finishedPage} of {totalFinishedPages}
                                                </span>
                                                <button
                                                    onClick={() => setFinishedPage(p => Math.min(totalFinishedPages, p + 1))}
                                                    disabled={finishedPage === totalFinishedPages}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })()}
                    {activeTab === "logs" && (() => {
                        const totalLogPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));
                        const paginatedLogs = logs.slice((logsPage - 1) * ITEMS_PER_PAGE, logsPage * ITEMS_PER_PAGE);
                        return (
                            <div className="relative bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-sm overflow-auto flex-1 flex flex-col h-full">
                                <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black text-[#12A55C] tracking-tight">Activity Logs</h2>
                                        <p className="text-slate-400 text-xs md:text-sm mt-1">Track the history of board updates and tasks.</p>
                                    </div>
                                </div>
                                {logs.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                                        <h3 className="font-bold text-slate-500 mb-1">No Activity Logged Yet</h3>
                                        <p className="text-xs md:text-sm text-slate-400 max-w-sm">When users add, move, or delete tasks, the history will appear here.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-3 md:space-y-4 max-w-4xl">
                                            {paginatedLogs.map((log) => {
                                                const isDelete = log.action.includes("DELETE");
                                                const isAdd = log.action.includes("ADD");
                                                const isEdit = log.action.includes("EDIT");
                                                return (
                                                    <div key={log._id} className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all">
                                                        <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isDelete ? 'bg-[#9E2A2B]/10 text-[#9E2A2B]' : isAdd ? 'bg-[#12A55C]/10 text-[#12A55C]' : isEdit ? 'bg-blue-100 text-blue-500' : 'bg-[#F37A22]/10 text-[#F37A22]'}`}>
                                                            {isDelete ? "X" : isAdd ? "+" : isEdit ? "E" : "R"}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs md:text-sm text-slate-700">
                                                                <span className="font-bold text-[#F37A22] bg-white px-1.5 py-0.5 rounded-md border border-slate-100 shadow-sm mr-1">{log.displayName}</span>
                                                                {log.details}
                                                            </p>
                                                            <p className="text-[10px] md:text-xs text-slate-400 mt-1.5 font-medium">
                                                                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(log.createdAt))}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Pagination */}
                                        {totalLogPages > 1 && (
                                            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                                                    disabled={logsPage === 1}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                >
                                                    ← Prev
                                                </button>
                                                <span className="text-[11px] font-bold text-slate-400 px-2">
                                                    Page {logsPage} of {totalLogPages}
                                                </span>
                                                <button
                                                    onClick={() => setLogsPage(p => Math.min(totalLogPages, p + 1))}
                                                    disabled={logsPage === totalLogPages}
                                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })()}
                </main>
            </div>
        );
    }
    return null;
}