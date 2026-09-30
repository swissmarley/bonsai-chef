//
//  ToolRecordDetailView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 17.06.2024.
//

import SwiftUI

struct ToolRecordDetailView: View {
    @EnvironmentObject var toolsSupplementsData: ToolsSupplementsData
    @ObservedObject var record: ToolsSupplementsRecord
    @State private var showEditView = false
    
    @State private var isImageFullScreenPresented = false
    @State private var selectedImage: UIImage?
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        List {
            Section(header: Text("Descrizione")) {
                Text("Nome: \(record.toolName)")
                Text("Tipologia: \(record.type.rawValue)")
                Text("Genere: \(record.toolData1)")
                Text("Venditore: \(record.toolData2)")
                Text("Prezzo: \(record.toolData3)")
            }
            
            Section(header: Text("Links")) {
                ForEach(parseHyperlinks(record.toolData4), id: \.self) { textPart in
                    if let url = URL(string: textPart.trimmingCharacters(in: .whitespacesAndNewlines)),
                       UIApplication.shared.canOpenURL(url) {
                        Link(textPart, destination: url)
                            .foregroundColor(.blue)
                    } else {
                        Text(textPart)
                    }
                }
            }
            
            Section(header: Text("Dettagli")) {
                Text("ToolDetails: \(record.toolDetails)")
            }
            
            Section(header: Text("Fotos")) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))]) {
                    ForEach(record.toolPhotoPaths, id: \.self) { photoPath in
                        AsyncImage(imagePath: photoPath)
                            .cornerRadius(5)
                            .padding(5)
                            .onTapGesture {
                                selectedImage = loadImageFromDisk(with: photoPath)
                                isImageFullScreenPresented = true
                            }
                    }
                }
            }
        }
        .navigationTitle(record.toolName)
        .navigationBarItems(trailing: Button("Edit", systemImage: "square.and.pencil") {
            showEditView = true
        })
        
        .sheet(isPresented: $showEditView) {
            EditToolsSupplementView(record: record) {
                // Update the record in the ToolsSupplementsData
                if let index = toolsSupplementsData.records.firstIndex(where: { $0.id == record.id }) {
                    toolsSupplementsData.records[index] = record
                }
                showEditView = false
            }
            .environmentObject(toolsSupplementsData)
        }
        .sheet(isPresented: $isImageFullScreenPresented) {
            if let selectedImage = selectedImage {
                ImageFullScreenView(images: record.toolPhotoPaths.compactMap { loadImageFromDisk(with: $0) ?? UIImage() }, isPresented: $isImageFullScreenPresented)
            }
        }
    }
    
    func parseHyperlinks(_ text: String) -> [String] {
        // Split the details text by new lines and spaces to identify potential URLs
        return text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
    }
    
    func loadImageFromDocumentDirectory(_ path: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(path)
        guard let imageData = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: imageData)
    }
    
    func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }
    
    func loadImageFromDisk(with filename: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(filename)
        guard let imageData = try? Data(contentsOf: fileURL) else { return nil }
        return UIImage(data: imageData)
    }
}


