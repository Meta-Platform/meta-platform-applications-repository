import type { ComponentType, ReactNode } from "react"

export type StoryControl = {
    label: string
    type: "text" | "boolean" | "select"
    options?: string[]
}

export type ComponentStory = {
    id: string
    title: string
    group: string
    description: string
    component: ComponentType<any>
    props?: Record<string, unknown>
    controls?: Record<string, StoryControl>
    sourcePackage: string
    notes?: ReactNode
}

export type StoryCollection = {
    id: string
    title: string
    description: string
    stories: ComponentStory[]
}
