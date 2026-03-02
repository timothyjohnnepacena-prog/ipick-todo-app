"use client";
import { useState, useEffect, useCallback } from "react";
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

interface Task {
    _id: string;
    text: string;
    listId: string;
    order: number;
    displayName: string;
    createdAt?: string;
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
}

function TaskCard({ task, fetchData, isOverlay, isDragging, setTasks }: TaskCardProps) {
    const { showPrompt, showConfirm, showAlert } = useModal();
    return (
        <div
            className={`bg-white p-4 rounded-xl border shadow-sm touch-none transition-all group ${isOverlay ? 'border-[#F37A22] shadow-2xl scale-105 rotate-2 cursor-grabbing' : 'border-slate-100 cursor-grab'
                } ${isDragging ? 'opacity-30' : 'opacity-100'}`}
        >
            <p className="font-semibold text-slate-700 text-xs mb-3 leading-snug">{task.text}</p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                <span className="text-[10px] font-bold text-[#F37A22] bg-[#F37A22]/10 px-2 py-0.5 rounded-md uppercase">
                    {task.displayName}
                </span>
                <div className="flex items-center gap-3">
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={async () => {
                            const newText = await showPrompt({ title: "Edit Task", placeholder: "Enter new task text...", defaultValue: task.text, confirmText: "Save" });
                            if (newText && newText !== task.text) {
                                if (setTasks) setTasks(prev => prev.map(t => t._id === task._id ? { ...t, text: newText } : t));
                                fetch("/api/todos", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ type: "edit_task", taskId: task._id, newText })
                                }).then(async res => {
                                    if (!res.ok) await showAlert({ title: "Permission Denied", message: "You don't have permission to edit this task.", variant: "danger" });
                                    if (fetchData) fetchData(true);
                                });
                            }
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-blue-500 uppercase transition-colors"
                    >
                        Edit
                    </button>
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={async () => {
                            const yes = await showConfirm({ title: "Delete Task", message: `Remove "${task.text}" from the board?`, variant: "danger", confirmText: "Delete" });
                            if (yes) {
                                if (setTasks) setTasks(prev => prev.filter(t => t._id !== task._id));
                                fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task._id }) }).then(async res => {
                                    if (!res.ok) await showAlert({ title: "Permission Denied", message: "You don't have permission to delete this task.", variant: "danger" });
                                    if (fetchData) fetchData(true);
                                });
                            }
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-[#9E2A2B] uppercase transition-colors"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
}

function SortableTask({ task, fetchData, setTasks }: { task: Task; fetchData: (silent?: boolean) => void; setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task._id, data: { type: "Task", task }
    });
    const style = { transform: CSS.Translate.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <TaskCard task={task} fetchData={fetchData} setTasks={setTasks} isDragging={isDragging} />
        </div>
    );
}

function KanbanColumn({ list, tasks, fetchData, setTasks, setLists }: { list: List; tasks: Task[]; fetchData: (silent?: boolean) => void; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; setLists: React.Dispatch<React.SetStateAction<List[]>> }) {
    const { setNodeRef } = useDroppable({ id: list._id, data: { type: "List", list } });
    const [menuOpen, setMenuOpen] = useState(false);
    const listTasks = tasks.filter(t => t.listId === list._id);
    const { showPrompt, showConfirm } = useModal();

    const handleAddTask = async () => {
        const text = await showPrompt({ title: "New Task", placeholder: "What needs to be done?", confirmText: "Add Task" });
        if (text) {
            setTasks(prev => [...prev, { _id: `temp-${Date.now()}`, text, listId: list._id, order: 999, displayName: "You", createdAt: new Date().toISOString() }]);
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
        const yes = await showConfirm({ title: "Delete List", message: `This will permanently delete "${list.name}" and ALL tasks inside it.`, variant: "danger", confirmText: "Delete List" });
        if (yes) {
            setLists(prev => prev.filter(l => l._id !== list._id));
            setTasks(prev => prev.filter(t => t.listId !== list._id));
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
                    {listTasks.map(task => <SortableTask key={task._id} task={task} fetchData={fetchData} setTasks={setTasks} />)}
                </div>
            </SortableContext>
        </div>
    );
}

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

function DeleteLogsButton({ fetchData, setLogs }: { fetchData: (silent?: boolean) => void; setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
    const { showConfirm } = useModal();
    return (
        <button
            onClick={async () => {
                const yes = await showConfirm({ title: "Clear All Logs", message: "This will permanently delete all activity logs. This action cannot be undone.", variant: "danger", confirmText: "Delete All" });
                if (yes) {
                    setLogs([]);
                    fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "all_logs" }) }).then(() => fetchData(true));
                }
            }}
            className="bg-[#9E2A2B]/10 text-[#9E2A2B] px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-[#9E2A2B]/20 transition-colors uppercase tracking-wider shrink-0 border border-[#9E2A2B]/20"
        >
            Delete All
        </button>
    );
}

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

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setFetching(true);
        try {
            const userQuery = selectedUsers.length ? `?users=${selectedUsers.join(",")}` : "";
            const res = await fetch(`/api/todos${userQuery}`);
            // Only update state if the response is successful
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
        setActiveTask(tasks.find(t => t._id === event.active.id) || null);
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
        if (!over) return;

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

        // Find the dragged task safely
        const draggedTask = updatedTasks.find(t => t._id === activeId);
        if (!draggedTask) return;

        const destList = lists.find(l => l._id === draggedTask.listId);
        const logMessage = `Updated position for "${draggedTask.text}" in "${destList?.name || 'board'}"`;

        fetch("/api/todos", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bulk: true, tasks: updatedTasks, logMessage })
        }).then(() => fetchData(true)).catch(() => fetchData(true));
    };

    if (status === "loading") {
        return <div className="min-h-screen bg-[#F1F3F6] flex items-center justify-center font-black text-[#12A55C] animate-pulse text-sm tracking-widest uppercase">LOADING IPICK BOARD...</div>;
    }

    if (session) {
        const nickname = session?.user?.name?.split(' ')[0] || "User";
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
                        {!isSidebarCollapsed && <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-8 object-contain" />}
                        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-400 hover:text-[#12A55C] transition-colors p-1 rounded-md hover:bg-slate-50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                        </button>
                    </div>
                    <nav className="flex-1 mt-6 px-3 space-y-2">
                        <button onClick={() => { setActiveTab("board"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "board" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" /></svg>
                            <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>To Do Board</span>
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
                                    {lists.map(list => <KanbanColumn key={list._id} list={list} tasks={tasks} fetchData={fetchData} setTasks={setTasks} setLists={setLists} />)}
                                    <NewColumnButton fetchData={fetchData} setLists={setLists} />
                                </div>
                                <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
                                    {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    )}
                    {activeTab === "logs" && (
                        <div className="relative bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-sm overflow-auto flex-1 flex flex-col h-full">
                            <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-black text-[#12A55C] tracking-tight">Activity Logs</h2>
                                    <p className="text-slate-400 text-xs md:text-sm mt-1">Track the history of board updates and tasks.</p>
                                </div>

                                <DeleteLogsButton fetchData={fetchData} setLogs={setLogs} />
                            </div>

                            {logs.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <h3 className="font-bold text-slate-500 mb-1">No Activity Logged Yet</h3>
                                    <p className="text-xs md:text-sm text-slate-400 max-w-sm">When users add, move, or delete tasks, the history will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 md:space-y-4 max-w-4xl">
                                    {logs.map((log) => {
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
                            )}
                        </div>
                    )}
                </main>
            </div>
        );
    }
    return null;
}
